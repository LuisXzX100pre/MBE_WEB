// lib/auth.ts
import { cookies } from 'next/headers'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import {
  createSessionToken,
  verifySessionToken,
  type SessionRole,
} from './session'

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string) {
  return bcrypt.compare(password, hashedPassword)
}

export async function createToken(
  userId: string,
  role: SessionRole,
  username?: string
) {
  return createSessionToken({ userId, role, username })
}

export async function verifyToken(token: string) {
  return verifySessionToken(token)
}

export function hashTextToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function generatePasswordResetToken() {
  const token = randomBytes(32).toString('hex')
  const tokenHash = hashTextToken(token)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30)

  return { token, tokenHash, expiresAt }
}

export async function getCurrentUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get('token')?.value

  if (!token) return null

  const payload = await verifyToken(token)
  if (!payload?.userId) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      username: true,
      email: true,
      phone: true,
      role: true,
    },
  })

  return user
}

export async function isAdmin() {
  const user = await getCurrentUser()
  return user?.role === 'ADMIN'
}