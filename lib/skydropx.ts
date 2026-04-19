import 'server-only'

type Nullable<T> = T | null | undefined

export type SkydropxAddress = {
  country_code: string
  postal_code: string
  area_level1: string
  area_level2: string
  area_level3: string
  street1: string
  name: string
  company: string
  phone: string
  email: string
  reference?: string
  further_information?: string
  tax_id_number?: string
}

export type SkydropxParcel = {
  length: number
  width: number
  height: number
  weight: number
  package_protected?: boolean
  declared_value?: number
}

export type SkydropxQuotationInput = {
  orderId?: string
  addressFrom: {
    country_code: string
    postal_code: string
    area_level1: string
    area_level2: string
    area_level3: string
    tax_id_number?: string
  }
  addressTo: {
    country_code: string
    postal_code: string
    area_level1: string
    area_level2: string
    area_level3: string
    tax_id_number?: string
  }
  parcels: SkydropxParcel[]
  requestedCarriers?: string[]
}

export type SkydropxShipmentInput = {
  rateId: string
  addressFrom: SkydropxAddress
  addressTo: SkydropxAddress
  parcels: SkydropxParcel[]
  printingFormat?: 'standard' | 'thermal'
}

export type SkydropxRate = {
  id: string
  success: boolean
  provider_name: string
  provider_display_name: string
  provider_service_name: string
  provider_service_code?: string
  currency_code: string
  amount: number
  total: number
  service_fee?: number
  days?: number | null
  pickup?: boolean
  pickup_automatic?: boolean
  pickup_ocurre?: boolean
  extra_fees?: Array<{
    code?: string
    value?: string
  }>
  error_messages?: Array<Record<string, unknown>>
}

export type ShippingOption = {
  bucket: 'cheapest' | 'best_value' | 'express'
  rateId: string
  carrier: string
  carrierDisplayName: string
  serviceName: string
  serviceCode?: string
  currency: string
  amount: number
  total: number
  estimatedDays: number | null
  pickup: boolean
  raw: SkydropxRate
}

export type SkydropxQuotationResponse = {
  id: string
  is_completed: boolean
  quotation_scope?: Record<string, unknown>
  rates?: SkydropxRate[]
  packages?: Array<Record<string, unknown>>
  overweight?: boolean
}

export type SkydropxShipmentResponse = {
  data?: {
    id?: string
    type?: string
    attributes?: {
      id?: string
      label_url?: string | null
      tracking_number?: string | null
      tracking_url_provider?: string | null
      tracking_status?: string | null
      created_at?: string
      updated_at?: string
      rate?: {
        id?: string
        provider_name?: string
        provider_display_name?: string
        provider_service_name?: string
        amount?: number
        total?: number
        days?: number | null
      }
    }
  }
  included?: Array<{
    id?: string
    type?: string
    attributes?: {
      label_url?: string | null
      tracking_number?: string | null
      tracking_url_provider?: string | null
      tracking_status?: string | null
    }
  }>
}

export type SkydropxTrackingResponse = {
  [key: string]: unknown
}

type AccessTokenCache = {
  accessToken: string
  expiresAt: number
}

const DEFAULT_API_BASE = process.env.SKYDROPX_API_BASE?.trim() || 'https://pro.skydropx.com'

let tokenCache: Nullable<AccessTokenCache> = null

function assertEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`)
  }
  return value
}

function getClientId() {
  return assertEnv('SKYDROPX_CLIENT_ID')
}

function getClientSecret() {
  return assertEnv('SKYDROPX_CLIENT_SECRET')
}

function getApiBase() {
  return DEFAULT_API_BASE.replace(/\/+$/, '')
}

function safeNumber(value: unknown, fallback = 0): number {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : fallback
}

function safeIntegerOrNull(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? Math.round(num) : null
}

function normalizeCarrierName(value: string) {
  return value.trim().toLowerCase()
}

function dedupeByRateId(options: ShippingOption[]): ShippingOption[] {
  const seen = new Set<string>()
  const result: ShippingOption[] = []

  for (const option of options) {
    if (seen.has(option.rateId)) continue
    seen.add(option.rateId)
    result.push(option)
  }

  return result
}

function buildOption(bucket: ShippingOption['bucket'], rate: SkydropxRate): ShippingOption {
  return {
    bucket,
    rateId: rate.id,
    carrier: normalizeCarrierName(rate.provider_name),
    carrierDisplayName: rate.provider_display_name || rate.provider_name,
    serviceName: rate.provider_service_name,
    serviceCode: rate.provider_service_code,
    currency: rate.currency_code || 'MXN',
    amount: safeNumber(rate.amount),
    total: safeNumber(rate.total, safeNumber(rate.amount)),
    estimatedDays: safeIntegerOrNull(rate.days),
    pickup: Boolean(rate.pickup),
    raw: rate,
  }
}

function normalizeRates(rawRates: Nullable<SkydropxRate[]>): SkydropxRate[] {
  if (!Array.isArray(rawRates)) return []

  return rawRates
    .filter((rate) => rate && rate.success !== false)
    .map((rate) => ({
      ...rate,
      provider_name: String(rate.provider_name || '').trim(),
      provider_display_name: String(rate.provider_display_name || rate.provider_name || '').trim(),
      provider_service_name: String(rate.provider_service_name || '').trim(),
      currency_code: String(rate.currency_code || 'MXN').trim(),
      amount: safeNumber(rate.amount),
      total: safeNumber(rate.total, safeNumber(rate.amount)),
      days: safeIntegerOrNull(rate.days),
    }))
    .filter((rate) => Boolean(rate.id && rate.provider_name && rate.provider_service_name))
}

function sortByCheapest(rates: SkydropxRate[]) {
  return [...rates].sort((a, b) => {
    const totalDiff = safeNumber(a.total) - safeNumber(b.total)
    if (totalDiff !== 0) return totalDiff

    const daysA = safeIntegerOrNull(a.days) ?? 999
    const daysB = safeIntegerOrNull(b.days) ?? 999
    return daysA - daysB
  })
}

function sortByExpress(rates: SkydropxRate[]) {
  return [...rates].sort((a, b) => {
    const daysA = safeIntegerOrNull(a.days) ?? 999
    const daysB = safeIntegerOrNull(b.days) ?? 999
    if (daysA !== daysB) return daysA - daysB

    return safeNumber(a.total) - safeNumber(b.total)
  })
}

function pickBestValueRate(rates: SkydropxRate[]): Nullable<SkydropxRate> {
  if (!rates.length) return null
  if (rates.length === 1) return rates[0]

  const totals = rates.map((r) => safeNumber(r.total))
  const days = rates.map((r) => safeIntegerOrNull(r.days) ?? Math.max(...rates.map((x) => safeIntegerOrNull(x.days) ?? 7), 7))

  const minTotal = Math.min(...totals)
  const maxTotal = Math.max(...totals)
  const minDays = Math.min(...days)
  const maxDays = Math.max(...days)

  let bestRate: Nullable<SkydropxRate> = null
  let bestScore = Number.POSITIVE_INFINITY

  for (const rate of rates) {
    const total = safeNumber(rate.total)
    const eta = safeIntegerOrNull(rate.days) ?? maxDays

    const normalizedTotal =
      maxTotal === minTotal ? 0 : (total - minTotal) / (maxTotal - minTotal)

    const normalizedDays =
      maxDays === minDays ? 0 : (eta - minDays) / (maxDays - minDays)

    const score = normalizedTotal * 0.65 + normalizedDays * 0.35

    if (score < bestScore) {
      bestScore = score
      bestRate = rate
    }
  }

  return bestRate
}

async function readErrorBody(response: Response): Promise<string> {
  const text = await response.text()

  try {
    const parsed = JSON.parse(text) as Record<string, unknown>
    const directMessage =
      typeof parsed.message === 'string'
        ? parsed.message
        : typeof parsed.error === 'string'
          ? parsed.error
          : null

    if (directMessage) return directMessage

    if (parsed.errors) {
      return JSON.stringify(parsed.errors)
    }

    return text || `HTTP ${response.status}`
  } catch {
    return text || `HTTP ${response.status}`
  }
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()

  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: getClientId(),
    client_secret: getClientSecret(),
  })

  const response = await fetch(`${getApiBase()}/api/v1/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`No se pudo obtener el token de SkydropX: ${message}`)
  }

  const data = (await response.json()) as {
    access_token?: string
    expires_in?: number
  }

  if (!data.access_token) {
    throw new Error('SkydropX no devolvió access_token')
  }

  const expiresInSeconds = Number.isFinite(data.expires_in) ? Number(data.expires_in) : 7200

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + expiresInSeconds * 1000,
  }

  return data.access_token
}

async function skydropxRequest<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers || {})
  headers.set('Accept', 'application/json')

  const useAuth = init.auth !== false
  if (useAuth) {
    const token = await getAccessToken()
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${getApiBase()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await readErrorBody(response)
    throw new Error(`Error SkydropX ${response.status}: ${message}`)
  }

  return (await response.json()) as T
}

export function getStoreOriginAddress(): SkydropxAddress {
  const company = process.env.STORE_SHIPPING_COMPANY?.trim() || 'MBE'
  const name = process.env.STORE_SHIPPING_NAME?.trim() || 'MBE'
  const street = assertEnv('STORE_SHIPPING_STREET')
  const ext = process.env.STORE_SHIPPING_EXT_NUMBER?.trim()
  const intNumber = process.env.STORE_SHIPPING_INT_NUMBER?.trim()

  const street1 = [street, ext, intNumber ? `Int ${intNumber}` : '']
    .filter(Boolean)
    .join(' ')

  return {
    country_code: process.env.STORE_SHIPPING_COUNTRY_CODE?.trim() || 'MX',
    postal_code: assertEnv('STORE_SHIPPING_POSTAL_CODE'),
    area_level1: assertEnv('STORE_SHIPPING_STATE'),
    area_level2: assertEnv('STORE_SHIPPING_CITY'),
    area_level3: assertEnv('STORE_SHIPPING_COLONY'),
    street1,
    name,
    company,
    phone: assertEnv('STORE_SHIPPING_PHONE'),
    email: assertEnv('STORE_SHIPPING_EMAIL'),
    reference: process.env.STORE_SHIPPING_REFERENCE?.trim() || 'Tienda MBE',
    further_information: process.env.STORE_SHIPPING_FURTHER_INFORMATION?.trim() || '',
    tax_id_number: process.env.STORE_SHIPPING_TAX_ID?.trim() || '',
  }
}

export function buildDestinationAddress(input: {
  recipient: string
  company?: string
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
  countryCode?: string
  taxIdNumber?: string
}): SkydropxAddress {
  const street1 = [
    input.street.trim(),
    input.extNumber?.trim(),
    input.intNumber?.trim() ? `Int ${input.intNumber.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  return {
    country_code: input.countryCode?.trim() || 'MX',
    postal_code: input.postalCode.trim(),
    area_level1: input.state.trim(),
    area_level2: input.city.trim(),
    area_level3: input.colony.trim(),
    street1,
    name: input.recipient.trim(),
    company: input.company?.trim() || input.recipient.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    reference: input.reference?.trim() || 'Entrega a domicilio',
    further_information: input.furtherInformation?.trim() || '',
    tax_id_number: input.taxIdNumber?.trim() || '',
  }
}

export function buildQuotationAddressFromFull(address: SkydropxAddress) {
  return {
    country_code: address.country_code,
    postal_code: address.postal_code,
    area_level1: address.area_level1,
    area_level2: address.area_level2,
    area_level3: address.area_level3,
    tax_id_number: address.tax_id_number || undefined,
  }
}

export async function createQuotation(
  input: SkydropxQuotationInput
): Promise<SkydropxQuotationResponse> {
  return skydropxRequest<SkydropxQuotationResponse>('/api/v1/quotations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      quotation: {
        order_id: input.orderId,
        address_from: input.addressFrom,
        address_to: input.addressTo,
        parcels: input.parcels.map((parcel) => ({
          length: Math.round(parcel.length),
          width: Math.round(parcel.width),
          height: Math.round(parcel.height),
          weight: Number(parcel.weight),
          package_protected: Boolean(parcel.package_protected),
          declared_value:
            typeof parcel.declared_value === 'number' ? Number(parcel.declared_value) : undefined,
        })),
        requested_carriers: input.requestedCarriers?.map(normalizeCarrierName),
      },
    }),
  })
}

export async function getQuotation(quotationId: string): Promise<SkydropxQuotationResponse> {
  return skydropxRequest<SkydropxQuotationResponse>(
    `/api/v1/quotations/${encodeURIComponent(quotationId)}`,
    {
      method: 'GET',
    }
  )
}

export async function quoteAndWaitForRates(
  input: SkydropxQuotationInput,
  options?: {
    maxAttempts?: number
    delayMs?: number
  }
): Promise<SkydropxQuotationResponse> {
  const maxAttempts = options?.maxAttempts ?? 5
  const delayMs = options?.delayMs ?? 900

  const created = await createQuotation(input)
  let current = created

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const rates = normalizeRates(current.rates)
    if (current.is_completed || rates.length > 0) {
      return {
        ...current,
        rates,
      }
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs))
    current = await getQuotation(created.id)
  }

  return {
    ...current,
    rates: normalizeRates(current.rates),
  }
}

export function mapShippingOptionsFromQuotation(
  quotation: SkydropxQuotationResponse
): {
  quotationId: string
  isCompleted: boolean
  options: ShippingOption[]
  cheapest: Nullable<ShippingOption>
  bestValue: Nullable<ShippingOption>
  express: Nullable<ShippingOption>
} {
  const rates = normalizeRates(quotation.rates)

  if (!rates.length) {
    return {
      quotationId: quotation.id,
      isCompleted: quotation.is_completed,
      options: [],
      cheapest: null,
      bestValue: null,
      express: null,
    }
  }

  const cheapestRate = sortByCheapest(rates)[0] || null
  const expressRate = sortByExpress(rates)[0] || null
  const bestValueRate = pickBestValueRate(rates)

  const selectedOptions = dedupeByRateId(
    [cheapestRate, bestValueRate, expressRate]
      .filter(Boolean)
      .map((rate, index) => {
        const bucket: ShippingOption['bucket'][] = ['cheapest', 'best_value', 'express']
        return buildOption(bucket[index], rate as SkydropxRate)
      })
  )

  const cheapest = cheapestRate ? buildOption('cheapest', cheapestRate) : null
  const bestValue = bestValueRate ? buildOption('best_value', bestValueRate) : null
  const express = expressRate ? buildOption('express', expressRate) : null

  return {
    quotationId: quotation.id,
    isCompleted: quotation.is_completed,
    options: selectedOptions,
    cheapest,
    bestValue,
    express,
  }
}

export async function quoteShippingOptions(input: SkydropxQuotationInput) {
  const quotation = await quoteAndWaitForRates(input)
  return mapShippingOptionsFromQuotation(quotation)
}

export async function createShipment(
  input: SkydropxShipmentInput
): Promise<SkydropxShipmentResponse> {
  return skydropxRequest<SkydropxShipmentResponse>('/api/v1/shipments/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shipment: {
        rate_id: input.rateId,
        printing_format: input.printingFormat || 'thermal',
        address_from: input.addressFrom,
        address_to: input.addressTo,
        parcels: input.parcels.map((parcel) => ({
          length: Math.round(parcel.length),
          width: Math.round(parcel.width),
          height: Math.round(parcel.height),
          weight: Number(parcel.weight),
          package_protected: Boolean(parcel.package_protected),
          declared_value:
            typeof parcel.declared_value === 'number' ? Number(parcel.declared_value) : undefined,
        })),
      },
    }),
  })
}

export async function trackShipment(params: {
  trackingNumber: string
  carrierName: string
}): Promise<SkydropxTrackingResponse> {
  const trackingNumber = encodeURIComponent(params.trackingNumber.trim())
  const carrierName = encodeURIComponent(normalizeCarrierName(params.carrierName))

  return skydropxRequest<SkydropxTrackingResponse>(
    `/api/v1/shipments/tracking?tracking_number=${trackingNumber}&carrier_name=${carrierName}`,
    {
      method: 'GET',
    }
  )
}

export function extractShipmentData(response: SkydropxShipmentResponse) {
  const top = response.data?.attributes
  const included = Array.isArray(response.included) ? response.included : []

  const packageLike = included.find(
    (item) =>
      item?.attributes?.tracking_number ||
      item?.attributes?.label_url ||
      item?.attributes?.tracking_url_provider
  )?.attributes

  return {
    shipmentId: response.data?.id || top?.id || null,
    labelUrl: top?.label_url || packageLike?.label_url || null,
    trackingNumber: top?.tracking_number || packageLike?.tracking_number || null,
    trackingUrl: top?.tracking_url_provider || packageLike?.tracking_url_provider || null,
    trackingStatus: top?.tracking_status || packageLike?.tracking_status || null,
    carrier:
      top?.rate?.provider_display_name ||
      top?.rate?.provider_name ||
      null,
    service: top?.rate?.provider_service_name || null,
    estimatedDays:
      typeof top?.rate?.days === 'number' ? Math.round(top.rate.days) : null,
    shippingAmount:
      typeof top?.rate?.total === 'number'
        ? top.rate.total
        : typeof top?.rate?.amount === 'number'
          ? top.rate.amount
          : null,
  }
}

export function buildParcelsFromCartItems(
  items: Array<{
    quantity: number
    product: {
      price: number
      weightKg?: number | null
      parcelLength?: number | null
      parcelWidth?: number | null
      parcelHeight?: number | null
    }
  }>
): SkydropxParcel[] {
  const quantity = items.reduce((acc, item) => acc + Math.max(1, item.quantity), 0)

  const totalWeight = items.reduce((acc, item) => {
    const unitWeight = Number(item.product.weightKg ?? 0.4)
    return acc + unitWeight * Math.max(1, item.quantity)
  }, 0)

  const maxLength = Math.max(
    ...items.map((item) => Number(item.product.parcelLength ?? 30)),
    30
  )

  const maxWidth = Math.max(
    ...items.map((item) => Number(item.product.parcelWidth ?? 25)),
    25
  )

  const totalHeight = items.reduce((acc, item) => {
    const unitHeight = Number(item.product.parcelHeight ?? 4)
    return acc + unitHeight * Math.max(1, item.quantity)
  }, 0)

  const declaredValue = items.reduce((acc, item) => {
    return acc + Number(item.product.price) * Math.max(1, item.quantity)
  }, 0)

  return [
    {
      length: Math.max(1, Math.round(maxLength)),
      width: Math.max(1, Math.round(maxWidth)),
      height: Math.max(1, Math.round(totalHeight || Math.max(4, quantity * 2))),
      weight: Number(totalWeight.toFixed(3)),
      package_protected: false,
      declared_value: Number(declaredValue.toFixed(2)),
    },
  ]
}