import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { api, member } from '@/lib/community/api'
import { body, CommunityError } from '@/lib/community/validation'
import { communityBlobToken, imageTypes, videoTypes } from '@/lib/community/media'
export const runtime = 'nodejs'
export async function POST(request: Request) {
  return api(async () => {
    await member(request, true)
    const input = await body(request)
    if (input.type !== 'blob.generate-client-token') throw new CommunityError('Solicitud de upload invalida')
    return handleUpload({
      body: input as unknown as HandleUploadBody, request, token: communityBlobToken(),
      onBeforeGenerateToken: async pathname => {
        if (!/^community\/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp|gif|mp4|webm)$/.test(pathname)) throw new CommunityError('Nombre de archivo invalido')
        const video = /\.(mp4|webm)$/.test(pathname)
        return { allowedContentTypes: video ? videoTypes : imageTypes,
          maximumSizeInBytes: (video ? 50 : 10) * 1024 * 1024,
          validUntil: Date.now() + 10 * 60 * 1000, addRandomSuffix: true, allowOverwrite: false }
      },
    })
  })
}
