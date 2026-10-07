import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CommunityError, date, flag, period, text } from './validation'
import { prizeConfig } from './wheel-config'
export function campaignData(input: Record<string, unknown>) {
  const startsAt = date(input.startsAt, true), endsAt = date(input.endsAt, true)
  period(startsAt, endsAt)
  return {
    name: text(input.name, 'Nombre interno', 120), title: text(input.title, 'Título', 160),
    subtitle: text(input.subtitle, 'Frase principal', 240), description: text(input.description, 'Descripción', 1500),
    note: input.note === null || input.note === undefined || input.note === '' ? null : text(input.note, 'Nota', 240),
    active: flag(input.active), startsAt, endsAt, prizeWeights: prizeConfig(input.prizeWeights),
  }
}
/** Activating a campaign replaces the selected campaign, even when scheduled. */
export async function saveCampaign(input: Record<string, unknown>, id?: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const current = id ? await tx.communityWheelCampaign.findUnique({ where: { id } }) : null
        if (id && !current) throw new CommunityError('Campaña no encontrada', 404)
        const data = campaignData(current ? {
          ...current, title: current.title || current.name, subtitle: current.subtitle || 'Un giro por miembro.',
          description: current.description || 'Tu resultado se conserva en tu cuenta.',
          startsAt: current.startsAt?.toISOString() || null, endsAt: current.endsAt?.toISOString() || null, ...input,
        } : input)
        if (data.active) await tx.communityWheelCampaign.updateMany({ where: { active: true, ...(id ? { id: { not: id } } : {}) }, data: { active: false } })
        return id ? await tx.communityWheelCampaign.update({ where: { id }, data }) : await tx.communityWheelCampaign.create({ data })
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error
      if (attempt === 4) throw new CommunityError('Otra campaña está cambiando. Intenta nuevamente.', 409)
      await new Promise(resolve => setTimeout(resolve, 10 * (attempt + 1)))
    }
  }
  throw new CommunityError('No se pudo guardar la campaña', 409)
}
