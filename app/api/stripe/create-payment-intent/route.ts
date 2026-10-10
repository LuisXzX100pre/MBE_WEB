import { resolveCommunityBenefit, communityAmounts, communityBenefitMetadata, moneyCents } from '@/lib/community/benefits'
import { orderSelectionSnapshot, cartSnapshotMetadata } from '@/lib/checkout-variants'
import { productColorsInclude } from '@/lib/product-queries'
import { validateSelection, ProductSelectionError } from '@/lib/product-variants'
// app/api/stripe/create-payment-intent/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { getCurrentUser } from '@/lib/auth'
import { resolveCheckoutShipping, CheckoutShippingError } from '@/lib/shipping/checkout-shipping'
import type { LocalDeliveryLike } from '@/lib/local-delivery'

type CreatePaymentIntentBody = {
  preview?: boolean
  paymentIntentId?: string

  recipient: string
  phone: string
  email: string
  cardholderName: string

  postalCode: string
  state: string
  city: string
  colony: string
  street: string
  extNumber?: string
  intNumber?: string
  reference?: string
  furtherInformation?: string

  selectedShippingOption: LocalDeliveryLike
}

function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').slice(0, 25)
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function amountToStripeCents(amount: number) {
  return Math.round(amount * 100)
}

function buildShippingAddressText(input: {
  street: string
  extNumber?: string
  intNumber?: string
  colony: string
  city: string
  state: string
  postalCode: string
  reference?: string
}) {
  const line1 = [input.street, input.extNumber].filter(Boolean).join(' ')
  const line2 = input.intNumber ? `Int ${input.intNumber}` : ''
  const base = [line1, line2, input.colony, input.city, input.state, `CP ${input.postalCode}`]
    .filter(Boolean)
    .join(', ')

  if (input.reference) {
    return `${base}. Referencia: ${input.reference}`
  }

  return base
}

function buildShippingMetadataAddress(input: {
  recipient: string
  phone: string
  email: string
  street: string
  extNumber?: string
  intNumber?: string
  colony: string
  city: string
  state: string
  postalCode: string
  reference?: string
  furtherInformation?: string
}) {
  return {
    recipient: input.recipient,
    phone: normalizePhone(input.phone),
    email: input.email,
    street: input.street,
    extNumber: input.extNumber || '',
    intNumber: input.intNumber || '',
    colony: input.colony,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    reference: input.reference || '',
    furtherInformation: input.furtherInformation || '',
  }
}

async function getOwnedPendingPaymentIntent(userId: string, paymentIntentId: string) {
  return prisma.payment.findFirst({
    where: {
      paymentIntentId,
      order: {
        userId,
        status: {
          in: ['PENDING', 'CONFIRMED'],
        },
      },
    },
    include: {
      order: true,
    },
  })
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = (await request.json()) as CreatePaymentIntentBody

    const preview = body.preview === true
    const paymentIntentId = normalizeText(body.paymentIntentId)
    const recipient = normalizeText(body.recipient)
    const phone = normalizeText(body.phone)
    const email = normalizeText(body.email).toLowerCase()
    const cardholderName = normalizeText(body.cardholderName)

    const postalCode = normalizeText(body.postalCode)
    const state = normalizeText(body.state)
    const city = normalizeText(body.city)
    const colony = normalizeText(body.colony)
    const street = normalizeText(body.street)
    const extNumber = normalizeText(body.extNumber)
    const intNumber = normalizeText(body.intNumber)
    const reference = normalizeText(body.reference)
    const furtherInformation = normalizeText(body.furtherInformation)

    const rawSelectedShippingOption = body.selectedShippingOption

    if (!recipient || !phone || !email || (!preview && !cardholderName)) {
      return NextResponse.json(
        {
          error: 'Nombre, teléfono, correo y nombre del titular son requeridos',
        },
        { status: 400 }
      )
    }

    if (!postalCode || !state || !city || !colony || !street) {
      return NextResponse.json(
        {
          error: 'Completa todos los campos de dirección de envío',
        },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
        { status: 400 }
      )
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                sizes: true,
                colors: productColorsInclude,
              },
            },
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 })
    }

    for (const item of cart.items) validateSelection(item.product, item.productColorId, item.size, item.quantity)

    const subtotal = moneyCents(cart.items.reduce(
      (sum, item) => sum + item.quantity * item.product.price,
      0
    )) / 100

    if (subtotal <= 0) {
      return NextResponse.json(
        { error: 'El subtotal del pedido es inválido' },
        { status: 400 }
      )
    }

    const { option: selectedShippingOption, quotationId: shippingQuotationId } =
      await resolveCheckoutShipping({
        userId: user.id,
        items: cart.items,
        selectedOption: rawSelectedShippingOption,
        destination: {
          recipient, phone: normalizePhone(phone), email, postalCode, state, city,
          colony, street, extNumber, intNumber, reference, furtherInformation,
        },
      })
    const shippingCost = selectedShippingOption.total

    const benefit = await resolveCommunityBenefit(user.id)
    const amounts = communityAmounts(subtotal, shippingCost, benefit)
    const total = amounts.total
    const benefitMetadata = communityBenefitMetadata(benefit, amounts)

    if (!Number.isFinite(total) || total <= 0) {
      return NextResponse.json(
        { error: 'El total del pedido es inválido' },
        { status: 400 }
      )
    }

    if (preview) return NextResponse.json({ success: true, benefit, amounts }, { headers: { 'Cache-Control': 'private, no-store' } })

    const cartSnapshot = cart.items.map(orderSelectionSnapshot)
    const snapshotMetadata = cartSnapshotMetadata(cartSnapshot)

    const shippingAddressText = buildShippingAddressText({
      street,
      extNumber,
      intNumber,
      colony,
      city,
      state,
      postalCode,
      reference,
    })

    const shippingMetadataAddress = buildShippingMetadataAddress({
      recipient,
      phone,
      email,
      street,
      extNumber,
      intNumber,
      colony,
      city,
      state,
      postalCode,
      reference,
      furtherInformation,
    })

    const existingPayment =
      paymentIntentId
        ? await getOwnedPendingPaymentIntent(user.id, paymentIntentId)
        : null

    let orderId: string
    let finalPaymentIntentId: string
    let clientSecret: string | null = null

    if (existingPayment?.order) {
      const updatedOrder = await prisma.order.update({
        where: { id: existingPayment.order.id, status: { in: ['PENDING', 'CONFIRMED'] }, inventoryDiscounted: false },
        data: {
          items: { deleteMany: {}, create: cartSnapshot },
          subtotal,
          shippingCost,
          total,

          shippingAddress: shippingAddressText,
          shippingFullName: recipient,
          shippingPhone: normalizePhone(phone),
          shippingEmail: email,
          shippingPostalCode: postalCode,
          shippingState: state,
          shippingCity: city,
          shippingNeighborhood: colony,
          shippingStreet: street,
          shippingExtNumber: extNumber || null,
          shippingIntNumber: intNumber || null,
          shippingReference: reference || null,
          shippingCountry: 'MX',

          shippingCarrier:
            selectedShippingOption.carrierDisplayName || selectedShippingOption.carrier,
          shippingService: selectedShippingOption.serviceName,
          shippingRateId: selectedShippingOption.rateId,
          shippingQuotationId,
          shippingBucket: selectedShippingOption.bucket || null,
          shippingEstimatedDays:
            typeof selectedShippingOption.estimatedDays === 'number'
              ? selectedShippingOption.estimatedDays
              : null,
          shippingQuoteJson: selectedShippingOption,
        },
      })

      const updatedIntent = await stripe.paymentIntents.update(paymentIntentId, {
        amount: amountToStripeCents(total),
        currency: 'mxn',
        receipt_email: email,
        description: `Checkout MBE ${user.id}`,
        metadata: {
          userId: user.id,
          orderId: updatedOrder.id,
          email,
          cardholderName,
          shippingAddress: shippingAddressText,
          phoneNumber: normalizePhone(phone),
          shippingCarrier:
            selectedShippingOption.carrierDisplayName || selectedShippingOption.carrier,
          shippingService: selectedShippingOption.serviceName,
          shippingRateId: selectedShippingOption.rateId,
          shippingQuotationId: shippingQuotationId || '',
          shippingCost: shippingCost.toFixed(2),
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          shippingRecipient: recipient,
          shippingPostalCode: postalCode,
          shippingState: state,
          shippingCity: city,
          shippingAddressJson: JSON.stringify(shippingMetadataAddress),
          shippingQuoteJson: JSON.stringify(selectedShippingOption),
          ...snapshotMetadata,
          ...benefitMetadata,
        },
      })

      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          provider: 'stripe',
          payerEmail: email,
          receiptEmail: email,
          paymentMethodId: null,
          status: 'PENDING',
        },
      })

      orderId = updatedOrder.id
      finalPaymentIntentId = updatedIntent.id
      clientSecret = updatedIntent.client_secret
    } else {
      const created = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            userId: user.id,
            subtotal,
            shippingCost,
            total,
            status: 'PENDING',

            shippingAddress: shippingAddressText,
            shippingFullName: recipient,
            shippingPhone: normalizePhone(phone),
            shippingEmail: email,
            shippingPostalCode: postalCode,
            shippingState: state,
            shippingCity: city,
            shippingNeighborhood: colony,
            shippingStreet: street,
            shippingExtNumber: extNumber || null,
            shippingIntNumber: intNumber || null,
            shippingReference: reference || null,
            shippingCountry: 'MX',

            shippingCarrier:
              selectedShippingOption.carrierDisplayName || selectedShippingOption.carrier,
            shippingService: selectedShippingOption.serviceName,
            shippingRateId: selectedShippingOption.rateId,
            shippingQuotationId,
            shippingBucket: selectedShippingOption.bucket || null,
            shippingEstimatedDays:
              typeof selectedShippingOption.estimatedDays === 'number'
                ? selectedShippingOption.estimatedDays
                : null,
            shippingQuoteJson: selectedShippingOption,

            items: {
              create: cartSnapshot,
            },
          },
        })

        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            provider: 'stripe',
            status: 'PENDING',
            payerEmail: email,
            receiptEmail: email,
          },
        })

        return { order, payment }
      })

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountToStripeCents(total),
        currency: 'mxn',
        payment_method_types: ['card'],
        receipt_email: email,
        description: `Checkout MBE ${user.id}`,
        metadata: {
          userId: user.id,
          orderId: created.order.id,
          email,
          cardholderName,
          shippingAddress: shippingAddressText,
          phoneNumber: normalizePhone(phone),
          shippingCarrier:
            selectedShippingOption.carrierDisplayName || selectedShippingOption.carrier,
          shippingService: selectedShippingOption.serviceName,
          shippingRateId: selectedShippingOption.rateId,
          shippingQuotationId: shippingQuotationId || '',
          shippingCost: shippingCost.toFixed(2),
          subtotal: subtotal.toFixed(2),
          total: total.toFixed(2),
          shippingRecipient: recipient,
          shippingPostalCode: postalCode,
          shippingState: state,
          shippingCity: city,
          shippingAddressJson: JSON.stringify(shippingMetadataAddress),
          shippingQuoteJson: JSON.stringify(selectedShippingOption),
          ...snapshotMetadata,
          ...benefitMetadata,
        },
      })

      await prisma.payment.update({
        where: { id: created.payment.id },
        data: {
          paymentIntentId: paymentIntent.id,
          payerEmail: email,
          receiptEmail: email,
          externalReference: created.order.id,
        },
      })

      orderId = created.order.id
      finalPaymentIntentId = paymentIntent.id
      clientSecret = paymentIntent.client_secret
    }

    return NextResponse.json({
      success: true,
      clientSecret,
      paymentIntentId: finalPaymentIntentId,
      orderId,
      benefit,
      amounts,
      shipping: {
        recipient,
        address: shippingAddressText,
        carrier:
          selectedShippingOption.carrierDisplayName || selectedShippingOption.carrier,
        service: selectedShippingOption.serviceName,
        rateId: selectedShippingOption.rateId,
        estimatedDays:
          typeof selectedShippingOption.estimatedDays === 'number'
            ? selectedShippingOption.estimatedDays
            : null,
      },
    })
  } catch (error) {
    console.error('[stripe:create-payment-intent]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo iniciar el pago con Stripe',
      },
      { status: error instanceof CheckoutShippingError || error instanceof ProductSelectionError ? 400 : 500 }
    )
  }
}
