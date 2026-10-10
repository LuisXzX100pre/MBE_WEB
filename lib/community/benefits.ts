import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
export type CommunityBenefit = { type: 'WHEEL' | 'TICKET'; id: string; percent: number; label: string }
export type CheckoutAmounts = { subtotal: number; shippingCost: number; discountPercent: number; discountAmount: number; discountedSubtotal: number; total: number; subtotalCents: number; shippingCostCents: number; discountAmountCents: number; totalCents: number }
export function moneyCents(amount: number) {
  const cents = Math.round(amount * 100)
  if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents < 0) throw new Error('Importe monetario inválido')
  return cents
}
export async function resolveCommunityBenefit(userId: string, now = new Date()): Promise<CommunityBenefit | null> {
  const [spins, tickets] = await Promise.all([
    prisma.communityWheelSpin.findMany({ where: { userId, usedAt: null }, select: { id: true, discountPercent: true, createdAt: true } }),
    prisma.communityTicket.findMany({ where: { userId, usedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { id: true, discountPercent: true, expiresAt: true, createdAt: true } }),
  ])
  const candidates = [
    ...spins.map(s => ({ type: 'WHEEL' as const, id: s.id, percent: s.discountPercent, label: 'Beneficio MBE · Ruleta ' + s.discountPercent + '%', expires: Infinity, created: s.createdAt.getTime() })),
    ...tickets.map(t => ({ type: 'TICKET' as const, id: t.id, percent: t.discountPercent, label: 'Beneficio MBE · Evento ' + t.discountPercent + '%', expires: t.expiresAt?.getTime() ?? Infinity, created: t.createdAt.getTime() })),
  ].filter(b => Number.isInteger(b.percent) && b.percent > 0 && b.percent <= 100)
  candidates.sort((a,b) => b.percent - a.percent || a.expires - b.expires || a.created - b.created || a.type.localeCompare(b.type) || a.id.localeCompare(b.id))
  const best = candidates[0]
  return best ? { type: best.type, id: best.id, percent: best.percent, label: best.label } : null
}
export function communityAmounts(subtotal: number, shippingCost: number, benefit: CommunityBenefit | null): CheckoutAmounts {
  const subtotalCents = moneyCents(subtotal), shippingCostCents = moneyCents(shippingCost)
  const discountPercent = benefit?.percent ?? 0
  if (!Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error('Beneficio inválido')
  const discountAmountCents = Math.round(subtotalCents * discountPercent / 100)
  const totalCents = subtotalCents - discountAmountCents + shippingCostCents
  return { subtotal: subtotalCents / 100, shippingCost: shippingCostCents / 100, discountPercent, discountAmount: discountAmountCents / 100, discountedSubtotal: (subtotalCents-discountAmountCents)/100, total: totalCents/100, subtotalCents, shippingCostCents, discountAmountCents, totalCents }
}
export function communityBenefitMetadata(benefit: CommunityBenefit | null, amounts: CheckoutAmounts) {
  return { communityBenefitType: benefit?.type ?? '', communityBenefitId: benefit?.id ?? '', communityDiscountPercent: String(amounts.discountPercent), communityDiscountAmount: amounts.discountAmount.toFixed(2), originalSubtotal: amounts.subtotal.toFixed(2), discountedSubtotal: amounts.discountedSubtotal.toFixed(2) }
}
export function readCommunityBenefitMetadata(metadata: Record<string,string>): CommunityBenefit | null {
  const type = metadata.communityBenefitType, id = metadata.communityBenefitId
  if (!type && !id) return null
  const percent = Number(metadata.communityDiscountPercent)
  if (!['WHEEL','TICKET'].includes(type) || !id || !Number.isInteger(percent) || percent <= 0 || percent > 100) throw new Error('Snapshot del beneficio inválido')
  return { type: type as CommunityBenefit['type'], id, percent, label: 'Beneficio MBE' }
}
export function validateCommunityPayment(metadata: Record<string,string>, paidCents: number) {
  const benefit = readCommunityBenefitMetadata(metadata)
  if (benefit) {
    for (const key of ['originalSubtotal','discountedSubtotal','communityDiscountAmount','shippingCost','total']) if (!metadata[key]?.trim()) throw new Error('Snapshot del descuento incompleto')
    const amounts = communityAmounts(Number(metadata.originalSubtotal), Number(metadata.shippingCost), benefit)
    if (amounts.totalCents !== paidCents || moneyCents(Number(metadata.total)) !== paidCents || moneyCents(Number(metadata.communityDiscountAmount)) !== amounts.discountAmountCents || moneyCents(Number(metadata.discountedSubtotal)) !== moneyCents(amounts.discountedSubtotal)) throw new Error('El pago no coincide con el descuento guardado')
  }
  return benefit
}
export async function consumeCommunityBenefit(tx: Prisma.TransactionClient, userId: string, benefit: CommunityBenefit | null) {
  if (!benefit) return
  const where = { id: benefit.id, userId, usedAt: null, discountPercent: benefit.percent }
  const data = { usedAt: new Date() }
  const result = benefit.type === 'WHEEL' ? await tx.communityWheelSpin.updateMany({ where, data }) : await tx.communityTicket.updateMany({ where, data })
  if (result.count !== 1) throw new Error('El beneficio de este pago ya se utilizó o no pertenece a la cuenta. Requiere revisión; no se consumirá otro beneficio.')
}
