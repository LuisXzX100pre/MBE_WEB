import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { assignTicket } from '@/lib/community/events'
export async function GET(request: Request) {
  return api(async () => {
    await member(undefined, true)
    const eventId = new URL(request.url).searchParams.get('eventId')
    return prisma.communityTicket.findMany({
      where: eventId ? { eventId } : {}, orderBy: { createdAt: 'desc' }, take: 200,
      include: { user: { select: { username: true } }, event: { select: { title: true } } },
    })
  })
}
export async function POST(request: Request) {
  return api(async () => { await member(request, true); return assignTicket(await body(request)) })
}
