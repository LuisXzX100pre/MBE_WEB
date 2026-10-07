import 'server-only'
import { randomInt } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { CommunityError } from './validation'

import { prizeConfig, wheelPrizes } from './wheel-config'
export { wheelPrizes } from './wheel-config'
export function choosePrize(draw = randomInt, prizes = wheelPrizes) {
  let value = draw(prizes.reduce((sum, p) => sum + p.weight, 0))
  for (const prize of prizes) { if (value < prize.weight) return prize.percent; value -= prize.weight }
  throw new Error('Invalid wheel weights')
}
export function liveCampaignWhere(now = new Date()): Prisma.CommunityWheelCampaignWhereInput {
  return { active: true, AND: [
    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
  ] }
}
export async function wheelState(userId: string) {
  const campaign = await prisma.communityWheelCampaign.findFirst({ where: liveCampaignWhere(), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
  const spin = campaign
    ? await prisma.communityWheelSpin.findUnique({ where: { userId_campaignId: { userId, campaignId: campaign.id } } })
    : await prisma.communityWheelSpin.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
  return { campaign, spin }
}
export async function spinWheel(userId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const campaign = await tx.communityWheelCampaign.findFirst({ where: liveCampaignWhere(), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] })
        if (!campaign) throw new CommunityError('No hay una campana disponible', 409)
        const previous = await tx.communityWheelSpin.findUnique({ where: { userId_campaignId: { userId, campaignId: campaign.id } } })
        if (previous) return { campaign, spin: previous }
        const spin = await tx.communityWheelSpin.create({ data: { userId, campaignId: campaign.id, discountPercent: choosePrize(randomInt, prizeConfig(campaign.prizeWeights)) } })
        return { campaign, spin }
      }, { isolationLevel: 'Serializable' })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || !['P2002', 'P2034'].includes(error.code)) throw error
      // A conflicting insert must be read back, never overwrite its prize.
      if (attempt === 2) throw new CommunityError('Hay otro giro en proceso. Consulta tu resultado nuevamente.', 409)
    }
  }
  throw new CommunityError('No se pudo completar el giro', 409)
}
