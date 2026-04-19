import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  buildDestinationAddress,
  buildParcelsFromCartItems,
  buildQuotationAddressFromFull,
  getStoreOriginAddress,
  quoteShippingOptions,
} from '@/lib/skydropx'
import { getCurrentUser } from '@/lib/auth'

type QuoteRequestBody = {
  recipient: string
  phone: string
  email: string
  postalCode: string
  state: string
  city: string
  colony: string
  street: string
  extNumber?: string
  intNumber?: string
  reference?: string
  furtherInformation?: string
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '').slice(0, 25)
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const body = (await req.json()) as QuoteRequestBody

    const recipient = normalizeText(body.recipient)
    const phone = normalizePhone(normalizeText(body.phone))
    const email = normalizeEmail(normalizeText(body.email))
    const postalCode = normalizeText(body.postalCode)
    const state = normalizeText(body.state)
    const city = normalizeText(body.city)
    const colony = normalizeText(body.colony)
    const street = normalizeText(body.street)
    const extNumber = normalizeText(body.extNumber)
    const intNumber = normalizeText(body.intNumber)
    const reference = normalizeText(body.reference)
    const furtherInformation = normalizeText(body.furtherInformation)

    if (!recipient) return badRequest('Falta el nombre del destinatario')
    if (!phone) return badRequest('Falta el teléfono')
    if (!email) return badRequest('Falta el correo electrónico')
    if (!postalCode) return badRequest('Falta el código postal')
    if (!state) return badRequest('Falta el estado')
    if (!city) return badRequest('Falta la ciudad')
    if (!colony) return badRequest('Falta la colonia')
    if (!street) return badRequest('Falta la calle')

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return badRequest('Formato de email inválido')
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: {
        items: {
          include: {
            product: {
              include: {
                sizes: true,
              },
            },
          },
        },
      },
    })

    if (!cart || cart.items.length === 0) {
      return badRequest('Tu carrito está vacío')
    }

    for (const item of cart.items) {
      const isLockedDrop =
        item.product.status === 'COMING_SOON' &&
        (!item.product.releaseAt || item.product.releaseAt.getTime() > Date.now())

      if (item.product.status === 'INACTIVE' || isLockedDrop) {
        return badRequest(`${item.product.name} aún no está disponible para compra`)
      }

      if (item.size) {
        const sizeData = item.product.sizes.find((s) => s.size === item.size)

        if (!sizeData || sizeData.stock < item.quantity) {
          return badRequest(
            `No hay stock suficiente de ${item.product.name} talla ${item.size}`
          )
        }
      } else if (item.product.stock < item.quantity) {
        return badRequest(`No hay stock suficiente de ${item.product.name}`)
      }
    }

    const parcels = buildParcelsFromCartItems(
      cart.items.map((item) => {
        const productAny = item.product as typeof item.product & {
          parcelLength?: number | null
          parcelWidth?: number | null
          parcelHeight?: number | null
          lengthCm?: number | null
          widthCm?: number | null
          heightCm?: number | null
        }

        return {
          quantity: item.quantity,
          product: {
            price: item.product.price,
            weightKg: item.product.weightKg,
            parcelLength: productAny.parcelLength ?? productAny.lengthCm ?? 30,
            parcelWidth: productAny.parcelWidth ?? productAny.widthCm ?? 25,
            parcelHeight: productAny.parcelHeight ?? productAny.heightCm ?? 4,
          },
        }
      })
    )

    const originAddress = getStoreOriginAddress()

    const destinationAddress = buildDestinationAddress({
      recipient,
      phone,
      email,
      postalCode,
      state,
      city,
      colony,
      street,
      extNumber,
      intNumber,
      reference,
      furtherInformation,
      countryCode: 'MX',
    })

    const quotation = await quoteShippingOptions({
      orderId: `quote_${user.id}_${Date.now()}`,
      addressFrom: buildQuotationAddressFromFull(originAddress),
      addressTo: buildQuotationAddressFromFull(destinationAddress),
      parcels,
    })

    if (!quotation.options.length) {
      return NextResponse.json(
        { error: 'No se encontraron tarifas de envío para esa dirección' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      quotationId: quotation.quotationId,
      options: quotation.options.map((option) => ({
        bucket: option.bucket,
        rateId: option.rateId,
        carrier: option.carrier,
        carrierDisplayName: option.carrierDisplayName,
        serviceName: option.serviceName,
        serviceCode: option.serviceCode,
        currency: option.currency,
        amount: option.amount,
        total: option.total,
        estimatedDays: option.estimatedDays,
        pickup: option.pickup,
      })),
      recommended: {
        cheapest: quotation.cheapest
          ? {
              bucket: quotation.cheapest.bucket,
              rateId: quotation.cheapest.rateId,
              carrier: quotation.cheapest.carrier,
              carrierDisplayName: quotation.cheapest.carrierDisplayName,
              serviceName: quotation.cheapest.serviceName,
              serviceCode: quotation.cheapest.serviceCode,
              currency: quotation.cheapest.currency,
              amount: quotation.cheapest.amount,
              total: quotation.cheapest.total,
              estimatedDays: quotation.cheapest.estimatedDays,
              pickup: quotation.cheapest.pickup,
            }
          : null,
        bestValue: quotation.bestValue
          ? {
              bucket: quotation.bestValue.bucket,
              rateId: quotation.bestValue.rateId,
              carrier: quotation.bestValue.carrier,
              carrierDisplayName: quotation.bestValue.carrierDisplayName,
              serviceName: quotation.bestValue.serviceName,
              serviceCode: quotation.bestValue.serviceCode,
              currency: quotation.bestValue.currency,
              amount: quotation.bestValue.amount,
              total: quotation.bestValue.total,
              estimatedDays: quotation.bestValue.estimatedDays,
              pickup: quotation.bestValue.pickup,
            }
          : null,
        express: quotation.express
          ? {
              bucket: quotation.express.bucket,
              rateId: quotation.express.rateId,
              carrier: quotation.express.carrier,
              carrierDisplayName: quotation.express.carrierDisplayName,
              serviceName: quotation.express.serviceName,
              serviceCode: quotation.express.serviceCode,
              currency: quotation.express.currency,
              amount: quotation.express.amount,
              total: quotation.express.total,
              estimatedDays: quotation.express.estimatedDays,
              pickup: quotation.express.pickup,
            }
          : null,
      },
      destination: {
        recipient,
        phone,
        email,
        postalCode,
        state,
        city,
        colony,
        street,
        extNumber,
        intNumber,
        reference,
        furtherInformation,
      },
      parcels,
    })
  } catch (error) {
    console.error('SKYDROPX_QUOTE_ERROR', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Ocurrió un error al cotizar el envío',
      },
      { status: 500 }
    )
  }
}