// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { syncInventoryByStatus } from '@/lib/inventory'
import {
  buildDestinationAddress,
  buildParcelsFromCartItems,
  createShipment,
  extractShipmentData,
  getStoreOriginAddress,
} from '@/lib/skydropx'
import { isLocalFreeDeliveryOption } from '@/lib/local-delivery'

export const runtime = 'nodejs'

type StoredCartItem = {
  productId: string
  productName?: string
  quantity: number
  unitPrice: number
  size?: string | null
}

type StoredShippingAddress = {
  recipient?: string
  phone?: string
  email?: string
  street?: string
  extNumber?: string
  intNumber?: string
  colony?: string
  city?: string
  state?: string
  postalCode?: string
  reference?: string
  furtherInformation?: string
}

type StoredShippingQuote = {
  rateId?: string
  carrier?: string
  carrierDisplayName?: string
  serviceName?: string
  serviceCode?: string
  currency?: string
  amount?: number
  total?: number
  estimatedDays?: number | null
  pickup?: boolean
  bucket?: 'cheapest' | 'best_value' | 'express'
}

function parseJson<T>(raw: string | undefined | null): T | null {
  if (!raw) return null

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function parseCartSnapshot(raw: string | undefined): StoredCartItem[] {
  const parsed = parseJson<StoredCartItem[]>(raw)

  if (!Array.isArray(parsed)) return []

  return parsed.filter(
    (item) =>
      item &&
      typeof item.productId === 'string' &&
      typeof item.quantity === 'number' &&
      typeof item.unitPrice === 'number'
  )
}

function normalizePhone(phone: string | undefined | null) {
  return (phone || '').replace(/[^\d+]/g, '').slice(0, 25)
}

function isLocalOrder(order: {
  shippingRateId?: string | null
  shippingCarrier?: string | null
  shippingQuoteJson?: unknown
}) {
  if (
    order.shippingRateId === 'mbe-local-benito-juarez-free' ||
    order.shippingCarrier === 'mbe-local' ||
    order.shippingCarrier === 'Entrega local MBE'
  ) {
    return true
  }

  return isLocalFreeDeliveryOption(
    (order.shippingQuoteJson as StoredShippingQuote | null) || null
  )
}

async function clearCartForUser(userId: string | undefined | null) {
  if (!userId) return

  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: { id: true },
  })

  if (!cart) return

  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  })
}

async function findExistingPaymentFromIntent(paymentIntent: Stripe.PaymentIntent) {
  const metadataOrderId = paymentIntent.metadata.orderId || undefined

  return prisma.payment.findFirst({
    where: {
      OR: [
        { paymentIntentId: paymentIntent.id },
        { transactionId: paymentIntent.id },
        ...(metadataOrderId ? [{ orderId: metadataOrderId }] : []),
      ],
    },
    include: {
      order: true,
    },
  })
}

async function ensureShipmentForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  })

  if (!order) return

  const orderAny = order as typeof order & {
    skydropxShipmentId?: string | null
    shippingTrackingNumber?: string | null
    shippingTrackingUrl?: string | null
    shippingLabelUrl?: string | null
  }

  if (isLocalOrder(order as any)) {
    return
  }

  if (
    orderAny.skydropxShipmentId ||
    orderAny.shippingTrackingNumber ||
    orderAny.shippingLabelUrl
  ) {
    return
  }

  if (!order.shippingRateId) {
    console.warn('[stripe:webhook:shipment] La orden no tiene shippingRateId', {
      orderId,
    })
    return
  }

  if (
    !order.shippingFullName ||
    !order.shippingPhone ||
    !order.shippingEmail ||
    !order.shippingPostalCode ||
    !order.shippingState ||
    !order.shippingCity ||
    !order.shippingNeighborhood ||
    !order.shippingStreet
  ) {
    console.warn(
      '[stripe:webhook:shipment] La orden no tiene datos completos de destino',
      { orderId }
    )
    return
  }

  const addressFrom = getStoreOriginAddress()

  const addressTo = buildDestinationAddress({
    recipient: order.shippingFullName,
    company: order.shippingFullName,
    phone: order.shippingPhone,
    email: order.shippingEmail,
    postalCode: order.shippingPostalCode,
    state: order.shippingState,
    city: order.shippingCity,
    colony: order.shippingNeighborhood,
    street: order.shippingStreet,
    extNumber: order.shippingExtNumber || '',
    intNumber: order.shippingIntNumber || '',
    reference: order.shippingReference || '',
    furtherInformation: '',
    countryCode: 'MX',
  })

  const parcels = buildParcelsFromCartItems(
    order.items.map((item) => {
      const productAny = item.product as typeof item.product & {
        lengthCm?: number | null
        widthCm?: number | null
        heightCm?: number | null
        parcelLength?: number | null
        parcelWidth?: number | null
        parcelHeight?: number | null
      }

      return {
        quantity: item.quantity,
        product: {
          price: item.unitPrice,
          weightKg: item.product.weightKg,
          parcelLength: productAny.parcelLength ?? productAny.lengthCm ?? 30,
          parcelWidth: productAny.parcelWidth ?? productAny.widthCm ?? 25,
          parcelHeight: productAny.parcelHeight ?? productAny.heightCm ?? 4,
        },
      }
    })
  )

  try {
    const shipment = await createShipment({
      rateId: order.shippingRateId,
      addressFrom,
      addressTo,
      parcels,
    })

    const shipmentData = extractShipmentData(shipment)

    await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(shipmentData.shipmentId
          ? { skydropxShipmentId: shipmentData.shipmentId }
          : {}),
        ...(shipmentData.trackingNumber
          ? { shippingTrackingNumber: shipmentData.trackingNumber }
          : {}),
        ...(shipmentData.trackingUrl
          ? { shippingTrackingUrl: shipmentData.trackingUrl }
          : {}),
        ...(shipmentData.labelUrl ? { shippingLabelUrl: shipmentData.labelUrl } : {}),
        shippingCarrier: shipmentData.carrier || order.shippingCarrier,
        shippingService: shipmentData.service || order.shippingService,
        shippingEstimatedDays:
          typeof shipmentData.estimatedDays === 'number'
            ? shipmentData.estimatedDays
            : order.shippingEstimatedDays,
        status: order.status === 'PAID' ? 'PROCESSING' : order.status,
      } as any,
    })
  } catch (error) {
    console.error('[stripe:webhook:shipment]', error)
  }
}

async function createFallbackOrderFromSucceededPayment(
  paymentIntent: Stripe.PaymentIntent
) {
  const userId = paymentIntent.metadata.userId
  const email =
    paymentIntent.receipt_email || paymentIntent.metadata.email || undefined

  const shippingAddress = parseJson<StoredShippingAddress>(
    paymentIntent.metadata.shippingAddressJson
  )
  const shippingQuote = parseJson<StoredShippingQuote>(
    paymentIntent.metadata.shippingQuoteJson
  )
  const cartItems = parseCartSnapshot(paymentIntent.metadata.cartSnapshot)

  if (!userId || cartItems.length === 0) {
    throw new Error('Faltan datos para crear la orden fallback desde Stripe')
  }

  const subtotal = Number(paymentIntent.metadata.subtotal || 0)
  const shippingCost = Number(paymentIntent.metadata.shippingCost || 0)
  const total =
    Number(paymentIntent.metadata.total || 0) ||
    cartItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) +
      shippingCost

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        userId,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        shippingCost: Number.isFinite(shippingCost) ? shippingCost : 0,
        total: Number.isFinite(total) ? total : 0,
        status: 'PAID',

        shippingAddress: paymentIntent.metadata.shippingAddress || null,
        shippingFullName: shippingAddress?.recipient || null,
        shippingPhone: normalizePhone(
          shippingAddress?.phone || paymentIntent.metadata.phoneNumber
        ),
        shippingEmail: shippingAddress?.email || email || null,
        shippingPostalCode: shippingAddress?.postalCode || null,
        shippingState: shippingAddress?.state || null,
        shippingCity: shippingAddress?.city || null,
        shippingNeighborhood: shippingAddress?.colony || null,
        shippingStreet: shippingAddress?.street || null,
        shippingExtNumber: shippingAddress?.extNumber || null,
        shippingIntNumber: shippingAddress?.intNumber || null,
        shippingReference: shippingAddress?.reference || null,
        shippingCountry: 'MX',

        shippingCarrier:
          shippingQuote?.carrierDisplayName || shippingQuote?.carrier || null,
        shippingService: shippingQuote?.serviceName || null,
        shippingRateId: shippingQuote?.rateId || null,
        shippingBucket: shippingQuote?.bucket || null,
        shippingEstimatedDays:
          typeof shippingQuote?.estimatedDays === 'number'
            ? shippingQuote.estimatedDays
            : null,
        shippingQuoteJson: shippingQuote || undefined,

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
        orderId: createdOrder.id,
        provider: 'stripe',
        status: 'COMPLETED',
        transactionId: paymentIntent.id,
        paymentIntentId: paymentIntent.id,
        paymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
        payerEmail: email,
        receiptEmail: email,
        externalReference: createdOrder.id,
      },
    })

    return createdOrder
  })

  await clearCartForUser(userId)
  await syncInventoryByStatus(order.id, 'PAID')
  await ensureShipmentForOrder(order.id)

  return order.id
}

async function handleSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const existingPayment = await findExistingPaymentFromIntent(paymentIntent)
  const email =
    paymentIntent.receipt_email || paymentIntent.metadata.email || undefined

  if (!existingPayment) {
    await createFallbackOrderFromSucceededPayment(paymentIntent)
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: existingPayment.id },
      data: {
        provider: 'stripe',
        status: 'COMPLETED',
        transactionId: paymentIntent.id,
        paymentIntentId: paymentIntent.id,
        paymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
        payerEmail: email,
        receiptEmail: email,
        externalReference: existingPayment.orderId,
      },
    })

    if (existingPayment.order.status !== 'PAID') {
      await tx.order.update({
        where: { id: existingPayment.orderId },
        data: { status: 'PAID' },
      })
    }
  })

  await clearCartForUser(existingPayment.order.userId)
  await syncInventoryByStatus(existingPayment.orderId, 'PAID')
  await ensureShipmentForOrder(existingPayment.orderId)
}

async function handleProcessing(paymentIntent: Stripe.PaymentIntent) {
  const existingPayment = await findExistingPaymentFromIntent(paymentIntent)

  if (!existingPayment) return

  await prisma.payment.update({
    where: { id: existingPayment.id },
    data: {
      provider: 'stripe',
      status: 'PENDING',
      paymentIntentId: paymentIntent.id,
      paymentMethodId:
        typeof paymentIntent.payment_method === 'string'
          ? paymentIntent.payment_method
          : paymentIntent.payment_method?.id,
      payerEmail:
        paymentIntent.receipt_email || paymentIntent.metadata.email || null,
      receiptEmail:
        paymentIntent.receipt_email || paymentIntent.metadata.email || null,
    },
  })
}

async function handleFailedOrCanceled(paymentIntent: Stripe.PaymentIntent) {
  const existingPayment = await findExistingPaymentFromIntent(paymentIntent)

  if (!existingPayment) return

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: existingPayment.id },
      data: {
        provider: 'stripe',
        status: 'FAILED',
        paymentIntentId: paymentIntent.id,
        transactionId:
          eventCouldBeFinal(paymentIntent.status)
            ? paymentIntent.id
            : existingPayment.transactionId,
        paymentMethodId:
          typeof paymentIntent.payment_method === 'string'
            ? paymentIntent.payment_method
            : paymentIntent.payment_method?.id,
        payerEmail:
          paymentIntent.receipt_email || paymentIntent.metadata.email || null,
        receiptEmail:
          paymentIntent.receipt_email || paymentIntent.metadata.email || null,
      },
    })

    if (
      ['PENDING', 'CONFIRMED'].includes(existingPayment.order.status) &&
      !existingPayment.order.inventoryDiscounted
    ) {
      await tx.order.update({
        where: { id: existingPayment.orderId },
        data: { status: 'CANCELLED' },
      })
    }
  })
}

function eventCouldBeFinal(status: Stripe.PaymentIntent.Status) {
  return ['succeeded', 'canceled'].includes(status)
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
      err instanceof Error ? err.message : 'Firma del webhook inválida'
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