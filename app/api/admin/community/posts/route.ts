import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { postData } from '@/lib/community/posts'
export async function GET() {
  return api(async () => { await member(undefined, true); return prisma.communityPost.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }) })
}
export async function POST(request: Request) {
  return api(async () => { await member(request, true); return prisma.communityPost.create({ data: await postData(await body(request)) }) })
}
