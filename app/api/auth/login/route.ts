// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { cookies } from 'next/headers'
import {
  checkRateLimit,
  getClientIp,
  normalizeRateKey,
  tooManyRequestsResponse,
} from '@/lib/rate-limit'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const identifier = String(
      body?.identifier ?? body?.username ?? body?.email ?? ''
    ).trim()

    const password = String(body?.password ?? '')

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Usuario o correo y contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (identifier.length > 120 || password.length > 256) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }

    const clientIp = getClientIp(request)
    const normalizedIdentifier = normalizeRateKey(identifier)

    const ipLimit = checkRateLimit({
      namespace: 'auth:login:ip',
      key: clientIp,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    })

    if (!ipLimit.allowed) {
      return tooManyRequestsResponse(ipLimit.retryAfterSec)
    }

    const identifierLimit = checkRateLimit({
      namespace: 'auth:login:identifier',
      key: normalizedIdentifier,
      limit: 8,
      windowMs: 10 * 60 * 1000,
    })

    if (!identifierLimit.allowed) {
      return tooManyRequestsResponse(identifierLimit.retryAfterSec)
    }

    const normalizedEmail = identifier.toLowerCase()

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: identifier,
              mode: 'insensitive',
            },
          },
          {
            email: {
              equals: normalizedEmail,
              mode: 'insensitive',
            },
          },
        ],
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const token = await createToken(user.id, user.role, user.username)

    const cookieStore = await cookies()
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json({ error: 'Error al iniciar sesión' }, { status: 500 })
  }
}