// lib/mercadopago.ts
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN

// ==========================
// VALIDACIÓN DEL TOKEN
// ==========================
export const isMercadoPagoConfigured =
  !!accessToken && accessToken.length > 10

if (!accessToken) {
  console.warn(
    '[MercadoPago] ACCESS_TOKEN no configurado. Agrega MERCADOPAGO_ACCESS_TOKEN en tus variables de entorno.'
  )
} else {
  if (accessToken.startsWith('TEST-')) {
    console.log('[MercadoPago] Usando token de PRUEBA (sandbox)')
  } else if (accessToken.startsWith('APP_USR-')) {
    console.log('[MercadoPago] Usando token de PRODUCCION')
  } else {
    console.warn(
      '[MercadoPago] Formato de token no reconocido. Asegurate de usar el token correcto.'
    )
  }

  console.log('[MercadoPago] Token length:', accessToken.length)
}

// ==========================
// CLIENTE MP
// ==========================
export const mercadoPagoClient = isMercadoPagoConfigured
  ? new MercadoPagoConfig({
      accessToken: accessToken!,
      options: {
        timeout: 10000,
      },
    })
  : null

export const preference = mercadoPagoClient
  ? new Preference(mercadoPagoClient)
  : null

export const payment = mercadoPagoClient
  ? new Payment(mercadoPagoClient)
  : null

// ==========================
// BASE URL (🔥 FIX REAL)
// ==========================
export const getBaseUrl = () => {
  // 1. Dominio manual (EL MÁS IMPORTANTE)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  // 2. Vercel (preview o prod)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // 3. Localhost (desarrollo)
  return 'http://localhost:3000'
}

// ==========================
// DETECTAR PRODUCCIÓN REAL
// ==========================
export const isProduction = () => {
  const baseUrl = getBaseUrl()
  return !baseUrl.includes('localhost')
}

// ==========================
// TIPOS
// ==========================
export interface MercadoPagoItem {
  id: string
  title: string
  quantity: number
  unit_price: number
  currency_id?: string
}

export interface CreatePreferenceData {
  items: MercadoPagoItem[]
  payer?: {
    email?: string
    name?: string
  }
  external_reference: string
  notification_url?: string
  back_urls?: {
    success: string
    failure: string
    pending: string
  }
  auto_return?: 'approved' | 'all'
}