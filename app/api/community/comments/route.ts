import { prisma } from '@/lib/prisma'
import { api, member } from '@/lib/community/api'
import { body, text, CommunityError } from '@/lib/community/validation'
import { commentSelect } from '@/lib/community/posts'
export async function GET(request: Request) {
  return api(async () => {
    await member()
    const url = new URL(request.url), postId = text(url.searchParams.get('postId'), 'Publicacion', 100), cursor = url.searchParams.get('cursor')
    if (!await prisma.communityPost.findFirst({ where: { id: postId, published: true }, select: { id: true } })) throw new CommunityError('Publicacion no encontrada', 404)
    if (cursor && !await prisma.communityComment.findFirst({ where: { id: cursor, postId }, select: { id: true } })) throw new CommunityError('Comentario no encontrado', 404)
    const comments = await prisma.communityComment.findMany({
      where: { postId }, select: commentSelect, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    return { comments, nextCursor: comments.length === 20 ? comments[comments.length - 1].id : null }
  })
}
export async function POST(request: Request) {
  return api(async () => {
    const user = await member(request), input = await body(request)
    const postId = text(input.postId, 'Publicacion', 100), content = text(input.text, 'Comentario', 1000)
    return prisma.$transaction(async tx => {
      if (!await tx.communityPost.findFirst({ where: { id: postId, published: true }, select: { id: true } })) throw new CommunityError('Publicacion no encontrada', 404)
      const recent = await tx.communityComment.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60000) } } })
      if (recent >= 5) throw new CommunityError('Espera un minuto antes de volver a comentar', 429)
      return tx.communityComment.create({ data: { userId: user.id, postId, text: content }, select: commentSelect })
    }, { isolationLevel: 'Serializable' })
  })
}
