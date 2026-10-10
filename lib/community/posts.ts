import 'server-only'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { flag, text, CommunityError } from './validation'
import { validateMedia } from './media'
export const commentSelect = { id: true, text: true, createdAt: true, user: { select: { username: true } } } satisfies Prisma.CommunityCommentSelect
const postSelect = { id: true, title: true, description: true, mediaType: true, thumbnailUrl: true, createdAt: true,
  comments: { select: commentSelect, take: 20, orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }] } } satisfies Prisma.CommunityPostSelect
const postOrder = [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
type Position = { id: string; createdAt: string }
function position(post: { id: string; createdAt: Date }): Position { return { id: post.id, createdAt: post.createdAt.toISOString() } }
function olderThan(post: Position): Prisma.CommunityPostWhereInput {
  const createdAt = new Date(post.createdAt)
  return { OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: post.id } }] }
}
function decodeCursor(cursor: string): { boundary: Position; last: Position } {
  try {
    if (cursor.length > 2048) throw new Error()
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    for (const p of [value.boundary, value.last]) {
      if (!p || typeof p.id !== 'string' || !p.id || p.id.length > 128 || typeof p.createdAt !== 'string' || !Number.isFinite(Date.parse(p.createdAt))) throw new Error()
    }
    return value
  } catch { throw new CommunityError('Cursor de archivo invalido') }
}
function privateThumbnails<T extends { id: string; thumbnailUrl: string | null }>(posts: T[]) {
  return posts.map(p => ({ ...p, thumbnailUrl: p.thumbnailUrl ? '/api/community/media/' + p.id + '?thumbnail=1' : null }))
}
export async function publishedRecentPosts() {
  return privateThumbnails(await prisma.communityPost.findMany({ where: { published: true }, select: postSelect, orderBy: postOrder, take: 3 }))
}
export async function publishedArchivePosts(cursor?: string, recent?: Awaited<ReturnType<typeof publishedRecentPosts>>) {
  const current = recent ?? await publishedRecentPosts()
  const paging = cursor ? decodeCursor(cursor) : null
  const boundary = paging?.boundary ?? (current.length === 3 ? position(current[2]) : null)
  if (!boundary) return { posts: [], nextCursor: null }
  const posts = await prisma.communityPost.findMany({
    where: { published: true, id: { notIn: current.map(p => p.id) }, AND: [olderThan(boundary), ...(paging ? [olderThan(paging.last)] : [])] },
    select: postSelect, orderBy: postOrder, take: 13,
  })
  const page = posts.slice(0, 12)
  return { posts: privateThumbnails(page), nextCursor: posts.length > 12
    ? Buffer.from(JSON.stringify({ boundary, last: position(page[page.length - 1]) })).toString('base64url') : null }
}
export async function publishedPosts(cursor?: string) {
  const recentPosts = await publishedRecentPosts()
  return { recentPosts, ...await publishedArchivePosts(cursor, recentPosts) }
}
export async function postData(input: Record<string, unknown>): Promise<Prisma.CommunityPostCreateInput> {
  const mediaType = input.mediaType
  if (mediaType !== 'IMAGE' && mediaType !== 'VIDEO') throw new CommunityError('Tipo de contenido invalido')
  return { title: text(input.title, 'Titulo', 160), description: text(input.description, 'Descripcion', 3000),
    published: flag(input.published), mediaType,
    mediaUrl: await validateMedia(input.mediaUrl, mediaType),
    thumbnailUrl: input.thumbnailUrl ? await validateMedia(input.thumbnailUrl, 'IMAGE') : null }
}
