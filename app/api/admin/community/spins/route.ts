import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { text } from '@/lib/community/validation'
export async function GET(request: Request) {
  return api(async () => {
    await member(undefined, true)
    const campaignId = text(new URL(request.url).searchParams.get('campaignId'), 'Campana', 100)
    return prisma.communityWheelSpin.findMany({ where: { campaignId }, orderBy: { createdAt: 'desc' }, take: 500, include: { user: { select: { username: true } } } })
  })
}
