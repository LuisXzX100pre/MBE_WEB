import 'server-only'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { flag, text, CommunityError } from './validation'
import { validateMedia, deleteCommunityMedia } from './media'
export const postMediaOrder = [{ order: 'asc' as const }, { id: 'asc' as const }]
export const commentSelect = { id: true, text: true, createdAt: true, user: { select: { username: true } } } satisfies Prisma.CommunityCommentSelect
const postSelect = { id: true, title: true, description: true, mediaType: true, thumbnailUrl: true, createdAt: true,
  media: { select: { id: true, order: true }, orderBy: postMediaOrder },
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
type StoredMedia = { id: string; url: string; order: number }
type ExistingPost = { mediaUrl: string; mediaType: 'IMAGE' | 'VIDEO'; media: StoredMedia[] }
async function validatedPost(input: Record<string, unknown>, existing?: ExistingPost) {
  const mediaType = input.mediaType
  if (mediaType !== 'IMAGE' && mediaType !== 'VIDEO') throw new CommunityError('Tipo de contenido invalido')
  let mediaUrls: string[] = []
  if (mediaType === 'IMAGE') {
    const values = input.mediaUrls !== undefined ? input.mediaUrls
      : existing?.mediaType === 'IMAGE' && existing.media.length && input.mediaUrl === existing.mediaUrl
        ? existing.media.map(m => m.url) : [input.mediaUrl]
    if (!Array.isArray(values) || values.length < 1 || values.length > 5) throw new CommunityError('Usa de 1 a 5 imagenes por publicacion')
    mediaUrls = await Promise.all(values.map(url => validateMedia(url, 'IMAGE')))
    if (new Set(mediaUrls).size !== mediaUrls.length) throw new CommunityError('No repitas imagenes en la galeria')
  } else if (input.mediaUrls !== undefined && (!Array.isArray(input.mediaUrls) || input.mediaUrls.length !== 0)) {
    throw new CommunityError('Un video no puede contener una galeria de imagenes')
  }
  return { title: text(input.title, 'Titulo', 160), description: text(input.description, 'Descripcion', 3000),
    published: flag(input.published), mediaType: mediaType as 'IMAGE' | 'VIDEO',
    mediaUrl: mediaType === 'IMAGE' ? mediaUrls[0] : await validateMedia(input.mediaUrl, 'VIDEO'),
    thumbnailUrl: mediaType === 'VIDEO' && input.thumbnailUrl ? await validateMedia(input.thumbnailUrl, 'IMAGE') : null,
    mediaUrls }
}
export async function postData(input: Record<string, unknown>): Promise<Prisma.CommunityPostCreateInput> {
  const { mediaUrls, ...data } = await validatedPost(input)
  return { ...data, ...(data.mediaType === 'IMAGE' ? { media: { create: mediaUrls.map((url, order) => ({ url, order })) } } : {}) }
}
export async function updatePost(id: string, input: Record<string, unknown>) {
  return prisma.$transaction(async tx => {
    const current = await tx.communityPost.findUnique({ where: { id }, include: { media: { orderBy: postMediaOrder } } })
    if (!current) throw new CommunityError('Publicacion no encontrada', 404)
    const { mediaUrls, ...data } = await validatedPost(input, current)
    const retained = new Set([data.mediaUrl, ...(data.thumbnailUrl ? [data.thumbnailUrl] : []), ...mediaUrls])
    const removed = [...new Set([current.mediaUrl, ...(current.thumbnailUrl ? [current.thumbnailUrl] : []), ...current.media.map(m => m.url)])].filter(url => !retained.has(url))
    if (removed.length) {
      const shared = await tx.communityPost.findFirst({ where: { id: { not: id }, OR: [
        { mediaUrl: { in: removed } }, { thumbnailUrl: { in: removed } }, { media: { some: { url: { in: removed } } } },
      ] }, select: { id: true } })
      if (shared) throw new CommunityError('Estos archivos se usan en otra publicacion. Cambia esa referencia antes de eliminarlos.', 409)
    }
    const updated = await tx.communityPost.update({ where: { id }, data: { ...data, media: {
      deleteMany: { url: { notIn: mediaUrls } },
      update: current.media.filter(m => mediaUrls.includes(m.url)).map(m => ({ where: { id: m.id }, data: { order: mediaUrls.indexOf(m.url) } })),
      create: mediaUrls.flatMap((url, order) => current.media.some(m => m.url === url) ? [] : [{ url, order }]),
    } }, include: { media: { orderBy: postMediaOrder } } })
    if (removed.length) await deleteCommunityMedia(removed[0], null, removed.slice(1))
    return updated
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 })
}
