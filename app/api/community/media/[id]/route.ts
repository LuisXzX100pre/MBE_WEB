import { get } from '@vercel/blob'
import { prisma } from '@/lib/prisma'
import { member } from '@/lib/community/api'
import { CommunityError } from '@/lib/community/validation'
import { communityBlobOptions, communityMediaUrl } from '@/lib/community/media'
export const runtime = 'nodejs'
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const user = await member()
    const post = await prisma.communityPost.findFirst({
      where: { id: params.id, ...(user.role === 'ADMIN' ? {} : { published: true }) }, select: { mediaUrl: true, thumbnailUrl: true },
    })
    const url = new URL(request.url).searchParams.get('thumbnail') === '1' ? post?.thumbnailUrl : post?.mediaUrl
    if (!url) return new Response('No encontrado', { status: 404 })
    const range = request.headers.get('range')
    const blob = await get(communityMediaUrl(url), { access: 'private', ...await communityBlobOptions(), ...(range ? { headers: { Range: range } } : {}) })
    if (!blob || !blob.stream) return new Response('No encontrado', { status: 404 })
    const headers = new Headers({ 'Content-Type': blob.blob.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes' })
    for (const key of ['content-range', 'content-length']) { const value = blob.headers.get(key); if (value) headers.set(key, value) }
    return new Response(blob.stream, { headers, status: headers.has('content-range') ? 206 : 200 })
  } catch (error) {
    return new Response(error instanceof CommunityError ? error.message : 'No se pudo cargar el archivo', { status: error instanceof CommunityError ? error.status : 502 })
  }
}
