// lib/session.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

export type SessionRole = 'ADMIN' | 'CLIENTE'

export type SessionPayload = JWTPayload & {
  userId: string
  role?: SessionRole
  username?: string
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim()

  if (!secret) {
    throw new Error('Falta JWT_SECRET en variables de entorno')
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres')
  }

  return new TextEncoder().encode(secret)
}

const JWT_SECRET = getJwtSecret()

export async function createSessionToken(input: {
  userId: string
  role: SessionRole
  username?: string
}) {
  return new SignJWT({
    userId: input.userId,
    role: input.role,
    username: input.username,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as SessionPayload
  } catch {
    return null
  }
}