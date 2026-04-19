// lib/local-delivery.ts

export type LocalDeliveryLike = {
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

export const LOCAL_FREE_DELIVERY_RATE_ID = 'mbe-local-benito-juarez-free'
export const LOCAL_FREE_DELIVERY_CARRIER = 'mbe-local'
export const LOCAL_FREE_DELIVERY_CARRIER_NAME = 'Entrega local MBE'
export const LOCAL_FREE_DELIVERY_SERVICE_NAME = 'Envío gratis en Cancún'

function normalizeComparable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export function isBenitoJuarezCancunDestination(input: {
  state?: string
  city?: string
}) {
  const normalizedState = normalizeComparable(input.state || '')
  const normalizedCity = normalizeComparable(input.city || '')

  if (normalizedState !== 'quintana roo') {
    return false
  }

  return ['benito juarez', 'cancun'].includes(normalizedCity)
}

export function buildLocalFreeDeliveryOption(): Required<LocalDeliveryLike> {
  return {
    bucket: 'cheapest',
    rateId: LOCAL_FREE_DELIVERY_RATE_ID,
    carrier: LOCAL_FREE_DELIVERY_CARRIER,
    carrierDisplayName: LOCAL_FREE_DELIVERY_CARRIER_NAME,
    serviceName: LOCAL_FREE_DELIVERY_SERVICE_NAME,
    serviceCode: 'LOCAL_FREE',
    currency: 'MXN',
    amount: 0,
    total: 0,
    estimatedDays: 1,
    pickup: false,
  }
}

export function isLocalFreeDeliveryOption(option: LocalDeliveryLike | null | undefined) {
  if (!option) return false

  return (
    option.rateId === LOCAL_FREE_DELIVERY_RATE_ID ||
    option.carrier === LOCAL_FREE_DELIVERY_CARRIER
  )
}

export function formatShippingAmount(option: LocalDeliveryLike | null | undefined) {
  if (!option) return 'Cotiza tu envío'
  if (isLocalFreeDeliveryOption(option)) return 'Gratis'

  const total = Number(option.total ?? 0)
  return `${total.toFixed(2)} MXN`
}