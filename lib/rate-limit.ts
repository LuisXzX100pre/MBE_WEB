// lib/rate-limit.ts
import { NextResponse } from 'next/server'

type RateLimitEntry = {
  count: number
  resetAt: number
}

const globalForRateLimit = globalThis as typeof globalThis & {
  __mbeRateLimitStore?: Map<string, RateLimitEntry>
}

const store = globalForRateLimit.__mbeRateLimitStore ?? new Map<string, RateLimitEntry>()

if (!globalForRateLimit.__mbeRateLimitStore) {
  globalForRateLimit.__mbeRateLimitStore = store
}

function cleanupStore(now: number) {
  if (store.size < 5000) return

  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now) {
      store.delete(key)
    }
  }
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  return 'unknown'
}

export function normalizeRateKey(value: string) {
  return value.trim().toLowerCase().slice(0, 180)
}

export function checkRateLimit(input: {
  namespace: string
  key: string
  limit: number
  windowMs: number
}) {
  const now = Date.now()
  cleanupStore(now)

  const safeNamespace = normalizeRateKey(input.namespace)
  const safeKey = normalizeRateKey(input.key || 'unknown')
  const compositeKey = `${safeNamespace}:${safeKey}`

  const current = store.get(compositeKey)

  if (!current || current.resetAt <= now) {
    const resetAt = now + input.windowMs
    store.set(compositeKey, {
      count: 1,
      resetAt,
    })

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      retryAfterSec: Math.ceil(input.windowMs / 1000),
      resetAt,
    }
  }

  if (current.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      resetAt: current.resetAt,
    }
  }

  current.count += 1
  store.set(compositeKey, current)

  return {
    allowed: true,
    remaining: Math.max(0, input.limit - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    resetAt: current.resetAt,
  }
}

export function tooManyRequestsResponse(
  retryAfterSec: number,
  message = 'Demasiados intentos. Intenta de nuevo más tarde.'
) {
  const response = NextResponse.json({ error: message }, { status: 429 })
  response.headers.set('Retry-After', String(retryAfterSec))
  response.headers.set('Cache-Control', 'no-store')
  return response
}