import 'server-only'
import { head } from '@vercel/blob'
import { CommunityError } from './validation'
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const videoTypes = ['video/mp4', 'video/webm']
export function communityBlobToken() {
  const token = process.env.COMMUNITY_BLOB_READ_WRITE_TOKEN
  if (!token) throw new CommunityError('Falta COMMUNITY_BLOB_READ_WRITE_TOKEN', 503)
  return token
}
export async function validateMedia(value: unknown, type: 'IMAGE' | 'VIDEO') {
  if (typeof value !== 'string' || value.length > 2048) throw new CommunityError('Archivo invalido')
  let url: URL
  try { url = new URL(value) } catch { throw new CommunityError('URL de archivo invalida') }
  const token = communityBlobToken()
  const storeId = token.split('_')[3]
  if (!storeId || url.protocol !== 'https:' || url.hostname !== storeId.toLowerCase() + '.private.blob.vercel-storage.com' ||
    !url.pathname.startsWith('/community/') || url.username || url.password || url.search || url.hash) throw new CommunityError('Usa el uploader privado de Comunidad')
  const blob = await head(url.href, { token })
  if (!(type === 'IMAGE' ? imageTypes : videoTypes).includes(blob.contentType) || blob.size > (type === 'IMAGE' ? 10 : 50) * 1024 * 1024) throw new CommunityError('Tipo o tamano invalido')
  return url.href
}
