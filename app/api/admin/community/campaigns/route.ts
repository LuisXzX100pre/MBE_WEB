import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { campaignData } from '@/lib/community/campaigns'
export async function GET() {
  return api(async () => { await member(undefined, true); return prisma.communityWheelCampaign.findMany({
    orderBy: { createdAt: 'desc' }, take: 100, include: { _count: { select: { spins: true } } },
  }) })
}
export async function POST(request: Request) {
  return api(async () => { await member(request, true); return prisma.communityWheelCampaign.create({ data: campaignData(await body(request)) }) })
}
