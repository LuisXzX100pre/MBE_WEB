import 'server-only'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { flag, text, CommunityError } from './validation'
import { validateMedia } from './media'
export const commentSelect = { id: true, text: true, createdAt: true, user: { select: { username: true } } } satisfies Prisma.CommunityCommentSelect
export async function publishedPosts(cursor?: string) {
  if (cursor && !await prisma.communityPost.findFirst({ where: { id: cursor, published: true }, select: { id: true } })) throw new CommunityError('Publicacion no encontrada', 404)
  const posts = await prisma.communityPost.findMany({
    where: { published: true },
    select: { id: true, title: true, description: true, mediaType: true, thumbnailUrl: true, createdAt: true,
      comments: { select: commentSelect, take: 20, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 12,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  })
  return { posts: posts.map(p => ({ ...p, thumbnailUrl: p.thumbnailUrl ? '/api/community/media/' + p.id + '?thumbnail=1' : null })),
    nextCursor: posts.length === 12 ? posts[posts.length - 1].id : null }
}
export async function postData(input: Record<string, unknown>): Promise<Prisma.CommunityPostCreateInput> {
  const mediaType = input.mediaType
  if (mediaType !== 'IMAGE' && mediaType !== 'VIDEO') throw new CommunityError('Tipo de contenido invalido')
  return { title: text(input.title, 'Titulo', 160), description: text(input.description, 'Descripcion', 3000),
    published: flag(input.published), mediaType,
    mediaUrl: await validateMedia(input.mediaUrl, mediaType),
    thumbnailUrl: input.thumbnailUrl ? await validateMedia(input.thumbnailUrl, 'IMAGE') : null }
}
