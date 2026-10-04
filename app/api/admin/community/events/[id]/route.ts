import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { eventData } from '@/lib/community/events'
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  return api(async () => { await member(request, true); return prisma.communityEvent.update({ where: { id: params.id }, data: eventData(await body(request)) }) })
}
