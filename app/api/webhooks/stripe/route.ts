// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { syncInventoryByStatus } from '@/lib/inventory'

export const runtime = 'nodejs'

async function markOrderPaid(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId
  const userId = paymentIntent.metadata.userId

  if (!orderId) return

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId },
      data: {
        provider: 'stripe',
        status: 'COMPLETED',
        transactionId: paymentIntent.id,
        paymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
        payerEmail:
          paymentIntent.receipt_email ||
          paymentIntent.metadata.email ||
          undefined,
      },
    })

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PAID',
      },
    })

    if (userId) {
      const cart = await tx.cart.findUnique({
        where: { userId },
      })

      if (cart) {
        await tx.cartItem.deleteMany({
          where: { cartId: cart.id },
        })
      }
    }
  })

  await syncInventoryByStatus(orderId, 'PAID')
}

async function markOrderProcessing(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId
  if (!orderId) return

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId },
      data: {
        provider: 'stripe',
        status: 'PENDING',
        transactionId: paymentIntent.id,
        paymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
        payerEmail:
          paymentIntent.receipt_email ||
          paymentIntent.metadata.email ||
          undefined,
      },
    })

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'PROCESSING',
      },
    })
  })

  await syncInventoryByStatus(orderId, 'PROCESSING')
}

async function markOrderFailed(paymentIntent: Stripe.PaymentIntent) {
  const orderId = paymentIntent.metadata.orderId
  if (!orderId) return

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { orderId },
      data: {
        provider: 'stripe',
        status: 'FAILED',
        transactionId: paymentIntent.id,
        paymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
        payerEmail:
          paymentIntent.receipt_email ||
          paymentIntent.metadata.email ||
          undefined,
      },
    })

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
      },
    })
  })

  await syncInventoryByStatus(orderId, 'CANCELLED')
}

export async function POST(req: Request) {
  const body = await req.text()
  const signature = (await headers()).get('stripe-signature')
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

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
        await markOrderPaid(paymentIntent)
        break
      }

      case 'payment_intent.processing': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await markOrderProcessing(paymentIntent)
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await markOrderFailed(paymentIntent)
        break
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        await markOrderFailed(paymentIntent)
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