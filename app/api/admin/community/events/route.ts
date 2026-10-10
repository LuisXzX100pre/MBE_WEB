import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { eventData } from '@/lib/community/events'
export async function GET() {
  return api(async () => { await member(undefined, true); return prisma.communityEvent.findMany({
    orderBy: { startsAt: 'desc' }, take: 100, include: { _count: { select: { tickets: true, interactions: true } } },
  }) })
}
export async function POST(request: Request) {
  return api(async () => { await member(request, true); return prisma.communityEvent.create({ data: eventData(await body(request)) }) })
}
