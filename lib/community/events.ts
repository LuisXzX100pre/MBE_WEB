import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { CommunityError, date, flag, period, text } from './validation'
import { eventTypes } from './event-config'
import type { EventType, EventOption } from './event-config'
export function eventOptions(value: unknown, type: EventType): EventOption[] {
  if (type !== 'DECISION' && type !== 'CHOICE') return []
  if (!Array.isArray(value) || value.length < 2 || value.length > (type === 'CHOICE' ? 2 : 6)) throw new CommunityError(type === 'CHOICE' ? 'The Choice requiere exactamente 2 opciones' : 'Usa de 2 a 6 opciones')
  const options = value.map(option => {
    if (!option || typeof option !== 'object' || Array.isArray(option)) throw new CommunityError('Opcion invalida')
    const key = text(option.key, 'Clave', 40), label = text(option.label, 'Opcion', 100)
    if (!/^[a-z0-9][a-z0-9_-]*$/.test(key)) throw new CommunityError('Clave de opcion invalida')
    return { key, label }
  })
  if (new Set(options.map(o => o.key)).size !== options.length || new Set(options.map(o => o.label.replace(/\s+/g, ' ').toLocaleLowerCase('es-MX'))).size !== options.length) throw new CommunityError('No repitas claves ni opciones')
  return options
}
type ExistingEvent = { type: EventType; options: Prisma.JsonValue; interactionPrompt: string | null }
export function eventData(input: Record<string, unknown>, existing?: ExistingEvent) {
  const startsAt = date(input.startsAt)!, endsAt = date(input.endsAt)!
  period(startsAt, endsAt)
  const type = input.type ?? existing?.type ?? 'ANNOUNCEMENT'
  if (!eventTypes.includes(type as EventType)) throw new CommunityError('Tipo de evento invalido')
  const eventType = type as EventType
  const prompt = input.interactionPrompt === undefined ? existing?.interactionPrompt : input.interactionPrompt
  const interactionPrompt = eventType === 'MISSION' ? text(prompt, 'Instruccion', 500) : prompt ? text(prompt, 'Instruccion', 500) : null
  const options = eventOptions(input.options === undefined ? existing?.options : input.options, eventType)
  return { title: text(input.title, 'Titulo', 160), description: text(input.description, 'Descripcion', 3000), active: flag(input.active), startsAt, endsAt,
    type: eventType, interactionPrompt, options: options.length ? options : Prisma.DbNull }
}
export async function updateEvent(id: string, input: Record<string, unknown>) {
  return prisma.$transaction(async tx => {
    const current = await tx.communityEvent.findUnique({ where: { id }, include: { _count: { select: { interactions: true } } } })
    if (!current) throw new CommunityError('Evento no encontrado', 404)
    const data = eventData(input, current)
    if (current._count.interactions > 0 && (data.type !== current.type ||
      JSON.stringify(eventOptions(current.options, current.type)) !== JSON.stringify(eventOptions(data.options, data.type)) ||
      (current.type === 'MISSION' && data.interactionPrompt !== current.interactionPrompt))) throw new CommunityError('Este evento ya tiene participaciones; conserva su tipo, instrucciones y opciones originales', 409)
    return tx.communityEvent.update({ where: { id }, data })
  }, { isolationLevel: 'Serializable' })
}
export async function interactWithEvent(userId: string, eventId: string, input: Record<string, unknown>) {
  try {
    return await prisma.$transaction(async tx => {
      const event = await tx.communityEvent.findUnique({ where: { id: eventId } })
      const now = new Date()
      if (!event) throw new CommunityError('Evento no encontrado', 404)
      if (!event.active || event.startsAt > now || event.endsAt <= now) throw new CommunityError('El evento no esta disponible para participar', 409)
      if (!event.type || event.type === 'ANNOUNCEMENT') throw new CommunityError('Los anuncios no admiten participacion', 400)
      if (await tx.communityEventInteraction.findUnique({ where: { eventId_userId: { eventId, userId } }, select: { id: true } })) throw new CommunityError('Ya registraste tu participacion; no puede cambiarse', 409)
      let optionKey: string | null = null, response: string | null = null
      if (event.type === 'MISSION') response = text(input.response, 'Respuesta', 500)
      else {
        optionKey = text(input.optionKey, 'Opcion', 40)
        if (!eventOptions(event.options, event.type).some(option => option.key === optionKey)) throw new CommunityError('La opcion no pertenece a este evento')
      }
      return tx.communityEventInteraction.create({ data: { eventId, userId, optionKey, response }, select: { id: true, optionKey: true, response: true, createdAt: true } })
    }, { isolationLevel: 'Serializable' })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new CommunityError('Participacion duplicada o concurrente. Revisa tu participacion antes de volver a intentar.', 409)
    throw error
  }
}
export function summarizeEvent(options: EventOption[], counts: { optionKey: string | null; _count: { _all: number } }[]) {
  const total = counts.reduce((sum, row) => sum + row._count._all, 0)
  return { total, options: options.map(option => {
    const count = counts.find(row => row.optionKey === option.key)?._count._all ?? 0
    return { ...option, count, percent: total ? Math.round(count / total * 1000) / 10 : 0 }
  }) }
}
async function eventResults(eventId: string, options: EventOption[]) {
  const counts = await prisma.communityEventInteraction.groupBy({ by: ['optionKey'], where: { eventId }, _count: { _all: true } })
  return summarizeEvent(options, counts)
}
export async function eventParticipation(eventId: string) {
  const event = await prisma.communityEvent.findUnique({ where: { id: eventId }, select: { id: true, type: true, title: true, options: true } })
  if (!event) throw new CommunityError('Evento no encontrado', 404)
  const participants = await prisma.communityEventInteraction.findMany({ where: { eventId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true, optionKey: true, response: true, createdAt: true, user: { select: { username: true } } } })
  const results = event.type === 'DECISION' || event.type === 'CHOICE' ? summarizeEvent(eventOptions(event.options, event.type), participants.reduce<{ optionKey: string | null; _count: { _all: number } }[]>((counts, row) => {
    const count = counts.find(c => c.optionKey === row.optionKey)
    if (count) count._count._all++; else counts.push({ optionKey: row.optionKey, _count: { _all: 1 } })
    return counts
  }, [])) : null
  return { event: { id: event.id, type: event.type, title: event.title }, total: participants.length, results, participants }
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
      select: { id: true, type: true, title: true, description: true, interactionPrompt: true, options: true, startsAt: true, endsAt: true,
        interactions: { where: { userId }, take: 1, select: { id: true, optionKey: true, response: true, createdAt: true } } },
    }),
    prisma.communityTicket.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, discountPercent: true, code: true, createdAt: true, expiresAt: true, usedAt: true, event: { select: { title: true } } },
    }),
  ])
  return { events: await Promise.all(events.map(async ({ interactions, ...event }) => {
    const type = event.type ?? 'ANNOUNCEMENT', options = eventOptions(event.options, type), myInteraction = interactions?.[0] ?? null
    return { ...event, type, options, myInteraction, results: myInteraction && (type === 'DECISION' || type === 'CHOICE') ? await eventResults(event.id, options) : null }
  })), tickets }
}
