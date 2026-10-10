import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return api(async () => { await member(request, true); await prisma.communityComment.delete({ where: { id: params.id } }); return { success: true } })
}
