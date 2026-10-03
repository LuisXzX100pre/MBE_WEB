import 'server-only'

import {
  buildDestinationAddress,
  buildParcelsFromCartItems,
  buildQuotationAddressFromFull,
  getStoreOriginAddress,
  quoteShippingOptions,
} from '@/lib/skydropx'
import {
  buildLocalFreeDeliveryOption,
  isBenitoJuarezCancunDestination,
  isLocalFreeDeliveryOption,
  type LocalDeliveryLike,
} from '@/lib/local-delivery'

export class CheckoutShippingError extends Error {}

type CartShippingItem = {
  quantity: number
  product: {
    price: number
    weightKg?: number | null
    parcelLength?: number | null
    parcelWidth?: number | null
    parcelHeight?: number | null
    lengthCm?: number | null
    widthCm?: number | null
    heightCm?: number | null
  }
}

export async function resolveCheckoutShipping(input: {
  userId: string
  items: CartShippingItem[]
  selectedOption: LocalDeliveryLike | null | undefined
  destination: Parameters<typeof buildDestinationAddress>[0]
}) {
  if (isBenitoJuarezCancunDestination(input.destination)) {
    return { option: buildLocalFreeDeliveryOption(), quotationId: null }
  }

  const bucket = input.selectedOption?.bucket
  if (
    isLocalFreeDeliveryOption(input.selectedOption) ||
    !['cheapest', 'best_value', 'express'].includes(bucket || '')
  ) {
    throw new CheckoutShippingError('Debes seleccionar una opción de envío válida')
  }

  const parcels = buildParcelsFromCartItems(input.items.map(({ quantity, product }) => ({
    quantity,
    product: {
      price: product.price,
      weightKg: product.weightKg,
      parcelLength: product.parcelLength ?? product.lengthCm ?? 30,
      parcelWidth: product.parcelWidth ?? product.widthCm ?? 25,
      parcelHeight: product.parcelHeight ?? product.heightCm ?? 4,
    },
  })))
  const quotation = await quoteShippingOptions({
    orderId: `checkout_${input.userId}_${Date.now()}`,
    addressFrom: buildQuotationAddressFromFull(getStoreOriginAddress()),
    addressTo: buildQuotationAddressFromFull(buildDestinationAddress(input.destination)),
    parcels,
  })
  const selected = bucket === 'cheapest'
    ? quotation.cheapest
    : bucket === 'best_value' ? quotation.bestValue : quotation.express

  if (!quotation.isCompleted || !quotation.quotationId || !selected) {
    throw new CheckoutShippingError('No hay una tarifa disponible para la opción seleccionada')
  }
  if (
    selected.currency.toUpperCase() !== 'MXN' ||
    !Number.isFinite(selected.total) || selected.total < 0 ||
    !Number.isFinite(selected.amount) || selected.amount < 0
  ) {
    throw new CheckoutShippingError('La cotización de envío es inválida')
  }

  return {
    quotationId: quotation.quotationId,
    option: {
      bucket: selected.bucket,
      rateId: selected.rateId,
      carrier: selected.carrier,
      carrierDisplayName: selected.carrierDisplayName,
      serviceName: selected.serviceName,
      ...(selected.serviceCode ? { serviceCode: selected.serviceCode } : {}),
      currency: selected.currency,
      total: selected.total,
      amount: selected.amount,
      estimatedDays: selected.estimatedDays,
      pickup: selected.pickup,
    },
  }
}
