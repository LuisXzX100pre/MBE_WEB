import 'server-only'
import { createHmac, randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CommunityError, text, flag, date } from './validation'

const invalidCode = () => new CommunityError('Código inválido o no disponible.', 400)
export function normalizeAccessCode(value: unknown) {
  if (typeof value !== 'string' || value.length > 128) throw invalidCode()
  const code = value.trim().toUpperCase()
  if (!/^[A-Z0-9-]{8,64}$/.test(code)) throw invalidCode()
  return code
}
export function hashAccessCode(code: string) {
  const secret = process.env.JWT_SECRET?.trim()
  if (!secret || secret.length < 32) throw new Error('Invite signing configuration unavailable')
  // Domain-separated key from the existing secret; no additional environment secret.
  const key = createHmac('sha256', secret).update('mbe-community-invite-v1').digest()
  return createHmac('sha256', key).update(normalizeAccessCode(code)).digest('hex')
}
function inviteLabel(value: unknown, codeHash: string) {
  const name = text(value, 'Nombre', 80), normalized = name.toUpperCase()
  // A label is safe to list later. Never let an admin accidentally save the
  // full credential inside it, including when editing an existing invite.
  for (const fragment of normalized.match(/[A-Z0-9-]{8,}/g) || []) {
    for (let start = 0; start <= fragment.length - 8; start++) {
      for (let end = start + 8; end <= Math.min(fragment.length, start + 64); end++) {
        if (hashAccessCode(fragment.slice(start, end)) === codeHash) throw new CommunityError('Usa una etiqueta distinta al código de acceso.')
      }
    }
  }
  return name
}
export function generateAccessCode() {
  return 'MBE-' + randomBytes(16).toString('hex').toUpperCase().match(/.{8}/g)!.join('-')
}
export const inviteSelect = {
  id: true, name: true, type: true, maxUses: true, uses: true, active: true,
  expiresAt: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CommunityInviteSelect

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: 'Serializable' }) }
    catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error
      if (attempt === 4) throw new CommunityError('Hay otra solicitud en proceso. Intenta nuevamente.', 409)
      await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)))
    }
  }
  throw new CommunityError('Intenta nuevamente.', 409)
}

/** Attempts commit independently so failed redemptions do not reset the limit. */
async function recordAttempt(userId: string) {
  await serializable(async tx => {
    const now = new Date(), cutoff = new Date(now.getTime() - 10 * 60 * 1000)
    await tx.communityAccessAttempt.deleteMany({ where: { userId, createdAt: { lte: cutoff } } })
    const count = await tx.communityAccessAttempt.count({ where: { userId, createdAt: { gt: cutoff } } })
    if (count >= 5) throw new CommunityError('Demasiados intentos. Espera diez minutos para volver a intentar.', 429)
    await tx.communityAccessAttempt.create({ data: { userId, createdAt: now } })
  })
}

export async function redeemAccess(userId: string, value: unknown) {
  if (await prisma.communityMembership.findUnique({ where: { userId } })) return { member: true }
  await recordAttempt(userId)
  const codeHash = hashAccessCode(normalizeAccessCode(value))
  try {
    return await serializable(async tx => {
      if (await tx.communityMembership.findUnique({ where: { userId } })) return { member: true }
      const now = new Date()
      const invite = await tx.communityInvite.findUnique({ where: { codeHash } })
      if (!invite || !invite.active || (invite.expiresAt && invite.expiresAt <= now) || invite.uses >= invite.maxUses) throw invalidCode()
      // Atomic compare-and-increment. Serializable also protects concurrent edits to maxUses.
      const updated = await tx.communityInvite.updateMany({
        where: { id: invite.id, active: true, uses: { lt: invite.maxUses },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        data: { uses: { increment: 1 } },
      })
      if (updated.count !== 1) throw invalidCode()
      await tx.communityMembership.create({ data: { userId, joinedAt: now, lastSeenAt: now } })
      await tx.communityInviteRedemption.create({ data: { inviteId: invite.id, userId, redeemedAt: now } })
      return { member: true }
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (await prisma.communityMembership.findUnique({ where: { userId } })) return { member: true }
      throw invalidCode()
    }
    throw error
  }
}
function maxUses(value: unknown, type: 'INDIVIDUAL' | 'CAMPAIGN', uses = 0) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < Math.max(1, uses) || value > 10000 || (type === 'INDIVIDUAL' && value !== 1)) {
    throw new CommunityError('Define un límite de 1 a 10000, no menor a los usos actuales. Individual admite solo 1 uso.')
  }
  return value
}
export async function createInvite(input: Record<string, unknown>) {
  if (input.type !== 'INDIVIDUAL' && input.type !== 'CAMPAIGN') throw new CommunityError('Tipo de invitación inválido.')
  const code = input.code === undefined || input.code === '' ? generateAccessCode() : normalizeAccessCode(input.code)
  const codeHash = hashAccessCode(code)
  const name = inviteLabel(input.name, codeHash)
  const invite = await prisma.communityInvite.create({ data: {
    name, type: input.type, codeHash,
    maxUses: maxUses(input.maxUses, input.type), active: input.active === undefined ? true : flag(input.active),
    expiresAt: date(input.expiresAt, true),
  }, select: inviteSelect })
  return { invite, code }
}
export async function updateInvite(id: string, input: Record<string, unknown>) {
  return serializable(async tx => {
    const current = await tx.communityInvite.findUnique({ where: { id } })
    if (!current) throw new CommunityError('Invitación no encontrada.', 404)
    const name = input.name === undefined ? current.name : inviteLabel(input.name, current.codeHash)
    return tx.communityInvite.update({ where: { id }, data: {
      name, maxUses: maxUses(input.maxUses === undefined ? current.maxUses : input.maxUses, current.type, current.uses),
      active: input.active === undefined ? current.active : flag(input.active),
      expiresAt: input.expiresAt === undefined ? current.expiresAt : date(input.expiresAt, true),
    }, select: inviteSelect })
  })
}
export async function deleteInvite(id: string) {
  try {
    await serializable(async tx => {
      const invite = await tx.communityInvite.findUnique({ where: { id }, include: { _count: { select: { redemptions: true } } } })
      if (!invite) throw new CommunityError('Invitación no encontrada.', 404)
      if (invite.uses > 0 || invite._count.redemptions > 0) throw new CommunityError('Esta invitación ya fue utilizada. Puedes desactivarla.', 409)
      await tx.communityInvite.delete({ where: { id } })
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') throw new CommunityError('Esta invitación ya fue utilizada. Puedes desactivarla.', 409)
    throw error
  }
  return { success: true }
}
export async function listInvites(cursor?: string) {
  const rows = await prisma.communityInvite.findMany({ select: inviteSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  return { invites: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null }
}
export async function inviteHistory(inviteId: string, cursor?: string) {
  if (!await prisma.communityInvite.findUnique({ where: { id: inviteId }, select: { id: true } })) throw new CommunityError('Invitación no encontrada.', 404)
  if (cursor && !await prisma.communityInviteRedemption.findFirst({ where: { id: cursor, inviteId }, select: { id: true } })) throw new CommunityError('Registro no encontrado.', 404)
  const rows = await prisma.communityInviteRedemption.findMany({ where: { inviteId },
    select: { id: true, redeemedAt: true, user: { select: { username: true } } },
    orderBy: [{ redeemedAt: 'desc' }, { id: 'desc' }], take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  return { redemptions: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null }
}
