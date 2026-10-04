import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body } from '@/lib/community/validation'
import { postData } from '@/lib/community/posts'
type Context = { params: { id: string } }
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => { await member(request, true); return prisma.communityPost.update({ where: { id: params.id }, data: await postData(await body(request)) }) })
}
export async function DELETE(request: Request, { params }: Context) {
  return api(async () => { await member(request, true); await prisma.communityPost.delete({ where: { id: params.id } }); return { success: true } })
}
