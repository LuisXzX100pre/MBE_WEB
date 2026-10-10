import 'server-only'
import { head, del } from '@vercel/blob'
import { getVercelOidcToken } from '@vercel/oidc'
import { CommunityError } from './validation'
export const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const videoTypes = ['video/mp4', 'video/webm']
export function communityBlobStoreId() {
  const storeId = process.env.BLOB_STORE_ID?.trim().replace(/^store_/, '')
  if (!storeId || !/^[a-zA-Z0-9]+$/.test(storeId)) throw new CommunityError('Falta BLOB_STORE_ID valido para mbe-community', 503)
  return storeId
}
export async function communityBlobOptions() {
  const storeId = communityBlobStoreId()
  // Resolve/refresh OIDC through the same provider as the SDK. Fail closed instead
  // of allowing the SDK to fall back to the product store read-write credential.
  let oidcToken: string
  try { oidcToken = await getVercelOidcToken() } catch { throw new CommunityError('OIDC de Vercel no disponible para Comunidad', 503) }
  if (!oidcToken?.trim()) throw new CommunityError('OIDC de Vercel no disponible para Comunidad', 503)
  return { storeId, oidcToken }
}
export function communityMediaUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) throw new CommunityError('Archivo invalido')
  let url: URL
  try { url = new URL(value) } catch { throw new CommunityError('URL de archivo invalida') }
  const storeId = communityBlobStoreId()
  if (url.protocol !== 'https:' || url.hostname !== storeId.toLowerCase() + '.private.blob.vercel-storage.com' ||
    !url.pathname.startsWith('/community/') || url.username || url.password || url.search || url.hash) throw new CommunityError('Usa el uploader privado de Comunidad')
  return url.href
}
export async function validateMedia(value: unknown, type: 'IMAGE' | 'VIDEO') {
  const url = communityMediaUrl(value)
  const blob = await head(url, await communityBlobOptions())
  if (!(type === 'IMAGE' ? imageTypes : videoTypes).includes(blob.contentType) || blob.size > (type === 'IMAGE' ? 10 : 50) * 1024 * 1024) throw new CommunityError('Tipo o tamano invalido')
  return url
}
export async function deleteCommunityMedia(mediaUrl: string, thumbnailUrl: string | null, galleryUrls: string[] = []) {
  // Validate every stored URL before deleting any file; never accept client URLs.
  const urls = [...new Set([mediaUrl, ...(thumbnailUrl ? [thumbnailUrl] : []), ...galleryUrls].map(communityMediaUrl))]
  const options = await communityBlobOptions()
  try { await del(urls, options) }
  catch { throw new CommunityError('No se pudieron eliminar los archivos privados. La publicacion se conserva; intenta nuevamente.', 502) }
}
