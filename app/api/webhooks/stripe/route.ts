import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { syncInventoryByStatus } from '@/lib/inventory'

export const runtime = 'nodejs'

type StoredCartItem = {
  productId: string
  quantity: number
  unitPrice: number
  size?: string | null
}

function parseCartSnapshot(raw: string | undefined): StoredCartItem[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item) =>
        item &&
        typeof item.productId === 'string' &&
        typeof item.quantity === 'number' &&
        typeof item.unitPrice === 'number'
    )
  } catch {
    return []
  }
}

async function createOrderFromSucceededPayment(
  paymentIntent: Stripe.PaymentIntent
) {
  const userId = paymentIntent.metadata.userId
  const email =
    paymentIntent.receipt_email || paymentIntent.metadata.email || undefined
  const shippingAddress = paymentIntent.metadata.shippingAddress || ''
  const phoneNumber = paymentIntent.metadata.phoneNumber || ''
  const cardholderName = paymentIntent.metadata.cardholderName || ''
  const cartItems = parseCartSnapshot(paymentIntent.metadata.cartSnapshot)

  if (!userId || cartItems.length === 0) {
    throw new Error('Faltan datos para crear la orden desde Stripe')
  }

  const existingPayment = await prisma.payment.findFirst({
    where: { transactionId: paymentIntent.id },
    select: { orderId: true },
  })

  if (existingPayment) {
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { orderId: existingPayment.orderId },
        data: {
          provider: 'stripe',
          status: 'COMPLETED',
          transactionId: paymentIntent.id,
          paymentMethodId:
            typeof paymentIntent.payment_method === 'string'
              ? paymentIntent.payment_method
              : paymentIntent.payment_method?.id,
          payerEmail: email,
          externalReference: paymentIntent.id,
        },
      })

      await tx.order.update({
        where: { id: existingPayment.orderId },
        data: { status: 'PAID' },
      })
    })

    return existingPayment.orderId
  }

  const total = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )

  const fullShippingInfo = [
    shippingAddress,
    phoneNumber ? `Tel: ${phoneNumber}` : '',
    email ? `Email: ${email}` : '',
    cardholderName ? `Titular: ${cardholderName}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const createdOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        userId,
        total,
        status: 'PAID',
        shippingAddress: fullShippingInfo || null,
        items: {
          create: cartItems.map((item) => ({
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            size: item.size ? (item.size as any) : undefined,
            productId: item.productId,
          })),
        },
      },
      select: { id: true },
    })

    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: 'stripe',
        status: 'COMPLETED',
        transactionId: paymentIntent.id,
        paymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
        payerEmail: email,
        externalReference: paymentIntent.id,
      },
    })

    const cart = await tx.cart.findUnique({
      where: { userId },
    })

    if (cart) {
      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      })
    }

    return order
  })

  await syncInventoryByStatus(createdOrder.id, 'PAID')

  return createdOrder.id
}

async function handleSucceeded(paymentIntent: Stripe.PaymentIntent) {
  await createOrderFromSucceededPayment(paymentIntent)
}

async function handleProcessing(_paymentIntent: Stripe.PaymentIntent) {
  // No creamos orden todavia.
  // Solo queremos pedidos reales cuando el pago ya fue exitoso.
  return
}

async function handleFailedOrCanceled(_paymentIntent: Stripe.PaymentIntent) {
  // No creamos orden y no vaciamos carrito.
  // Si el usuario abandona o falla el pago, todo debe seguir en carrito.
  return
}

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('stripe-signature')
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!signature || !endpointSecret) {
    return new NextResponse('Falta firma o secret del webhook', {
      status: 400,
    })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Firma del webhook invalida'
    console.error('[stripe:webhook:signature]', message)
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handleSucceeded(paymentIntent)
        break
      }

      case 'payment_intent.processing': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handleProcessing(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handleFailedOrCanceled(paymentIntent)
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await handleFailedOrCanceled(paymentIntent)
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[stripe:webhook:handler]', error)
    return new NextResponse('Error procesando webhook', { status: 500 })
  }
}