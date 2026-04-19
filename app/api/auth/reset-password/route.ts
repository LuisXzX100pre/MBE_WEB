import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, hashTextToken } from '@/lib/auth'

function isStrongPassword(password: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const token = String(body?.token ?? '').trim()
    const password = String(body?.password ?? '')
    const confirmPassword = String(body?.confirmPassword ?? '')

    if (!token || !password || !confirmPassword) {
      return NextResponse.json(
        { error: 'Token, contraseña y confirmación son requeridos' },
        { status: 400 }
      )
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

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: 'Las contraseñas no coinciden' },
        { status: 400 }
      )
    }

    const tokenHash = hashTextToken(token)

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!resetToken) {
      return NextResponse.json(
        { error: 'El enlace no es válido o ya expiró' },
        { status: 400 }
      )
    }

    const hashedPassword = await hashPassword(password)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      })

      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      })

      await tx.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: {
            not: resetToken.id,
          },
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Tu contraseña fue actualizada correctamente. Ahora inicia sesión.',
    })
  } catch (error) {
    console.error('Error en reset-password:', error)
    return NextResponse.json(
      { error: 'No se pudo restablecer la contraseña' },
      { status: 500 }
    )
  }
}