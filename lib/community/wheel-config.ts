import { CommunityError } from './validation'
export type WheelPrize = { percent: number; weight: number }
export const wheelPrizes: WheelPrize[] = [{ percent: 2, weight: 1 }, { percent: 4, weight: 1 }, { percent: 5, weight: 1 }, { percent: 10, weight: 1 }]
export function prizeConfig(value: unknown): WheelPrize[] {
  if (value === null || value === undefined) return wheelPrizes.map(prize => ({ ...prize }))
  if (!Array.isArray(value) || value.length !== 4) throw new CommunityError('Configura las cuatro opciones de ruleta.')
  const prizes = wheelPrizes.map(expected => {
    const matches = value.filter(item => item && typeof item === 'object' && item.percent === expected.percent)
    const weight = matches[0]?.weight
    if (matches.length !== 1 || !Number.isInteger(weight) || weight < 1 || weight > 1000) throw new CommunityError('Usa pesos enteros de 1 a 1000 para 2, 4, 5 y 10%.')
    return { percent: expected.percent, weight: weight as number }
  })
  if (!prizes.some(prize => prize.weight > 0)) throw new CommunityError('Al menos un premio debe tener peso mayor a cero.')
  return prizes
}
export type CampaignView = { id: string; name: string; title: string | null; subtitle: string | null; description: string | null; note: string | null; startsAt: string | null; endsAt: string | null; prizeWeights: unknown }
export type WheelState = { campaign: CampaignView | null; spin: { id: string; campaignId: string; discountPercent: number; usedAt: string | null; createdAt: string } | null }
