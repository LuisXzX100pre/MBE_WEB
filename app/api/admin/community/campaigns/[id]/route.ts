import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { campaignData } from '@/lib/community/campaigns'
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return api(async () => { await member(request, true); return prisma.communityWheelCampaign.update({ where: { id: params.id }, data: campaignData(await body(request)) }) })
}
