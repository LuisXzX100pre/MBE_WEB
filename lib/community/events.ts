import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { CommunityError, date, flag, period, text } from './validation'
export function eventData(input: Record<string, unknown>) {
  const startsAt = date(input.startsAt)!, endsAt = date(input.endsAt)!
  period(startsAt, endsAt)
  return { title: text(input.title, 'Titulo', 160), description: text(input.description, 'Descripcion', 3000), active: flag(input.active), startsAt, endsAt }
}
export function ticketPercent(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) throw new CommunityError('Porcentaje invalido: usa un entero de 1 a 100')
  return value
}
export function ticketCode() { return 'MBE-' + randomBytes(10).toString('hex').toUpperCase() }
export async function assignTicket(input: Record<string, unknown>) {
  const eventId = text(input.eventId, 'Evento', 100), username = text(input.username, 'Usuario', 100), discountPercent = ticketPercent(input.discountPercent)
  const requestedExpiry = date(input.expiresAt, true)
  return prisma.$transaction(async tx => {
    const event = await tx.communityEvent.findUnique({ where: { id: eventId } })
    if (!event || !event.active || event.endsAt <= new Date()) throw new CommunityError('El evento no esta disponible', 409)
    const user = await tx.user.findUnique({ where: { username }, select: { id: true } })
    if (!user) throw new CommunityError('Usuario no encontrado', 404)
    const expiresAt = requestedExpiry || event.endsAt
    if (expiresAt <= new Date() || expiresAt > event.endsAt) throw new CommunityError('La expiracion debe ser futura y no posterior al evento')
    return tx.communityTicket.create({ data: { eventId, userId: user.id, discountPercent, code: ticketCode(), expiresAt } })
  }, { isolationLevel: 'Serializable' })
}
export async function eventState(userId: string) {
  const [events, tickets] = await Promise.all([
    prisma.communityEvent.findMany({
      where: { active: true, endsAt: { gt: new Date() } }, orderBy: { startsAt: 'asc' }, take: 50,
      select: { id: true, title: true, description: true, startsAt: true, endsAt: true },
    }),
    prisma.communityTicket.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, discountPercent: true, code: true, createdAt: true, expiresAt: true, usedAt: true, event: { select: { title: true } } },
    }),
  ])
  return { events, tickets }
}
