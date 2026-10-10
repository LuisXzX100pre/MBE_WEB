import { issueSignedToken, presignUrl } from '@vercel/blob'
import { api, member } from '@/lib/community/api'
import { body, CommunityError } from '@/lib/community/validation'
import { communityBlobOptions, imageTypes, videoTypes } from '@/lib/community/media'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  return api(async () => {
    await member(request, true)
    const input = await body(request)
    if (input.type !== 'blob.generate-presigned-url') throw new CommunityError('Solicitud de upload invalida')
    const payload = input.payload
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new CommunityError('Solicitud de upload invalida')
    const { pathname, multipart } = payload as Record<string, unknown>
    if (typeof pathname !== 'string' || !/^community\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif|mp4|webm)$/.test(pathname)) throw new CommunityError('Nombre de archivo invalido')
    if (multipart !== undefined && typeof multipart !== 'boolean') throw new CommunityError('Solicitud de upload invalida')
    const video = /\.(mp4|webm)$/.test(pathname)
    const constraints = {
      pathname, allowedContentTypes: video ? videoTypes : imageTypes,
      maximumSizeInBytes: (video ? 50 : 10) * 1024 * 1024, validUntil: Date.now() + 10 * 60 * 1000,
    }
    const signedToken = await issueSignedToken({ ...await communityBlobOptions(), ...constraints, operations: ['put'] })
    const { presignedUrl } = await presignUrl(signedToken, {
      ...constraints, operation: 'put', access: 'private', addRandomSuffix: true, allowOverwrite: false,
    })
    // uploadPresigned expects the signed payload rather than the full URL.
    // No upload-completed callback is used, so no webhook key is required.
    const params = new URL(presignedUrl).searchParams
    const delegationToken = params.get('vercel-blob-delegation')
    const signature = params.get('vercel-blob-signature')
    if (!delegationToken || !signature) throw new CommunityError('Respuesta de upload invalida', 502)
    for (const key of ['pathname', 'vercel-blob-delegation', 'vercel-blob-signature']) params.delete(key)
    return { type: input.type, presignedUrlPayload: { delegationToken, signature, params: Object.fromEntries(params) } }
  })
}
