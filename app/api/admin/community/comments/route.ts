import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
export async function GET() {
  return api(async () => { await member(undefined, true); return prisma.communityComment.findMany({
    orderBy: { createdAt: 'desc' }, take: 200,
    include: { user: { select: { username: true } }, post: { select: { title: true } } },
  }) })
}
