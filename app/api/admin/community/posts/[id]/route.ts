import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body, CommunityError } from '@/lib/community/validation'
import { deleteCommunityMedia } from '@/lib/community/media'
import { postData } from '@/lib/community/posts'
type Context = { params: { id: string } }
export async function PATCH(request: Request, { params }: Context) {
  return api(async () => { await member(request, true); return prisma.communityPost.update({ where: { id: params.id }, data: await postData(await body(request)) }) })
}
export async function DELETE(request: Request, { params }: Context) {
  return api(async () => {
    await member(request, true)
    const post = await prisma.communityPost.findUnique({ where: { id: params.id }, select: { mediaUrl: true, thumbnailUrl: true } })
    if (!post) throw new CommunityError('Publicacion no encontrada', 404)
    const urls = [post.mediaUrl, ...(post.thumbnailUrl ? [post.thumbnailUrl] : [])]
    const shared = await prisma.communityPost.findFirst({
      where: { id: { not: params.id }, OR: [{ mediaUrl: { in: urls } }, { thumbnailUrl: { in: urls } }] }, select: { id: true },
    })
    if (shared) throw new CommunityError('Estos archivos se usan en otra publicacion. Cambia esa referencia antes de eliminar definitivamente.', 409)
    await deleteCommunityMedia(post.mediaUrl, post.thumbnailUrl)
    await prisma.communityPost.delete({ where: { id: params.id, mediaUrl: post.mediaUrl, thumbnailUrl: post.thumbnailUrl } })
    return { success: true }
  })
}
