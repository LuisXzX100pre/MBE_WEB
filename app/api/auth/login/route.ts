// app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { cookies } from 'next/headers'

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
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    const isValid = await verifyPassword(password, user.password)

    if (!isValid) {
      return NextResponse.json(
        { error: 'Credenciales incorrectas' },
        { status: 401 }
      )
    }

    const token = await createToken(user.id)

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
    return NextResponse.json(
      { error: 'Error al iniciar sesión' },
      { status: 500 }
    )
  }
}