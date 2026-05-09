// app/api/auth/register/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import {
  checkRateLimit,
  getClientIp,
  normalizeRateKey,
  tooManyRequestsResponse,
} from '@/lib/rate-limit'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidUsername(username: string) {
  return /^[a-zA-Z0-9._-]{3,24}$/.test(username)
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

function isStrongPassword(password: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const username = String(body?.username ?? '').trim()
    const email = String(body?.email ?? '').trim().toLowerCase()
    const phone = normalizePhone(String(body?.phone ?? '').trim())
    const password = String(body?.password ?? '')

    if (!username || !email || !phone || !password) {
      return NextResponse.json(
        { error: 'Usuario, correo, teléfono y contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (username.length > 24 || email.length > 120 || phone.length > 15 || password.length > 256) {
      return NextResponse.json(
        { error: 'Datos inválidos' },
        { status: 400 }
      )
    }

    const clientIp = getClientIp(request)

    const ipLimit = checkRateLimit({
      namespace: 'auth:register:ip',
      key: clientIp,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })

    if (!ipLimit.allowed) {
      return tooManyRequestsResponse(ipLimit.retryAfterSec)
    }

    const identityLimit = checkRateLimit({
      namespace: 'auth:register:identity',
      key: normalizeRateKey(`${email}:${username}`),
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })

    if (!identityLimit.allowed) {
      return tooManyRequestsResponse(identityLimit.retryAfterSec)
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          error:
            'El usuario debe tener entre 3 y 24 caracteres y solo puede incluir letras, números, punto, guion o guion bajo',
        },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Ingresa un correo válido' }, { status: 400 })
    }

    if (phone.length < 10 || phone.length > 15) {
      return NextResponse.json({ error: 'Ingresa un teléfono válido' }, { status: 400 })
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          error:
            'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo',
        },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: username,
              mode: 'insensitive',
            },
          },
          {
            email: {
              equals: email,
              mode: 'insensitive',
            },
          },
        ],
      },
    })

    if (existingUser?.username?.toLowerCase() === username.toLowerCase()) {
      return NextResponse.json(
        { error: 'Ese nombre de usuario ya está en uso' },
        { status: 400 }
      )
    }

    if (existingUser?.email?.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Ese correo ya está registrado' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    await prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          username,
          email,
          phone,
          password: hashedPassword,
        },
      })

      await tx.cart.create({
        data: {
          userId: createdUser.id,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Cuenta creada correctamente. Ahora inicia sesión.',
    })
  } catch (error) {
    console.error('Error en registro:', error)
    return NextResponse.json({ error: 'Error al registrar usuario' }, { status: 500 })
  }
}