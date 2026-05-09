// app/api/auth/forgot-password/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePasswordResetToken } from '@/lib/auth'
import { Resend } from 'resend'
import {
  checkRateLimit,
  getClientIp,
  normalizeRateKey,
  tooManyRequestsResponse,
} from '@/lib/rate-limit'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = String(body?.email ?? '').trim().toLowerCase()

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Ingresa un correo válido' }, { status: 400 })
    }

    if (email.length > 120) {
      return NextResponse.json({ error: 'Ingresa un correo válido' }, { status: 400 })
    }

    const clientIp = getClientIp(request)

    const ipLimit = checkRateLimit({
      namespace: 'auth:forgot:ip',
      key: clientIp,
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })

    if (!ipLimit.allowed) {
      return tooManyRequestsResponse(ipLimit.retryAfterSec)
    }

    const emailLimit = checkRateLimit({
      namespace: 'auth:forgot:email',
      key: normalizeRateKey(email),
      limit: 3,
      windowMs: 60 * 60 * 1000,
    })

    if (!emailLimit.allowed) {
      return tooManyRequestsResponse(emailLimit.retryAfterSec)
    }

    const genericMessage =
      'Si existe una cuenta con ese correo, te enviamos instrucciones para restablecer tu contraseña.'

    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
    })

    if (!user) {
      return NextResponse.json({ success: true, message: genericMessage })
    }

    if (!resend || !process.env.EMAIL_FROM || !process.env.APP_URL) {
      console.error('Falta configurar RESEND_API_KEY, EMAIL_FROM o APP_URL')
      return NextResponse.json(
        { error: 'El servicio de recuperación no está configurado' },
        { status: 500 }
      )
    }

    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    })

    const { token, tokenHash, expiresAt } = generatePasswordResetToken()

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    const appUrl = process.env.APP_URL.replace(/\/+$/, '')
    const resetUrl = `${appUrl}/restablecer-password?token=${token}`

    const result = await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: user.email!,
      subject: 'Restablece tu contraseña - MBE',
      html: `
        <div style="font-family: Arial, sans-serif; color: #111; line-height: 1.6;">
          <h2 style="margin-bottom: 8px;">Restablece tu contraseña</h2>
          <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en MBE.</p>
          <p>Este enlace será válido durante <strong>30 minutos</strong>.</p>
          <p style="margin: 24px 0;">
            <a
              href="${resetUrl}"
              style="background:#111;color:#fff;padding:12px 18px;border-radius:10px;text-decoration:none;display:inline-block;"
            >
              Restablecer contraseña
            </a>
          </p>
          <p>Si no solicitaste este cambio, puedes ignorar este correo.</p>
          <p style="font-size:12px;color:#666;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
          <p style="font-size:12px;color:#666;word-break:break-all;">${resetUrl}</p>
        </div>
      `,
    })

    if (result.error) {
      console.error('Error enviando correo con Resend:', result.error)

      await prisma.passwordResetToken.deleteMany({
        where: { tokenHash },
      })

      return NextResponse.json(
        { error: 'No se pudo enviar el correo de recuperación' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, message: genericMessage })
  } catch (error) {
    console.error('Error en forgot-password:', error)
    return NextResponse.json(
      { error: 'Error al procesar la recuperación' },
      { status: 500 }
    )
  }
}