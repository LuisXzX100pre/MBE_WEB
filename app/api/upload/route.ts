import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<NextResponse> {
  const admin = await isAdmin()

  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        const payload = clientPayload ? JSON.parse(clientPayload) : {}

        const mimeType = String(payload.mimeType || '')
        const size = Number(payload.size || 0)

        if (!allowedTypes.includes(mimeType)) {
          throw new Error('Tipo de archivo no valido. Usa JPG, PNG, WEBP o GIF')
        }

        // Client upload evita el 413 del serverless proxy,
        // pero seguimos validando un limite razonable para tu tienda.
        const maxSize = 10 * 1024 * 1024
        if (size > maxSize) {
          throw new Error('El archivo es muy grande. Maximo 10MB')
        }

        return {
          allowedContentTypes: allowedTypes,
          addRandomSuffix: true,
          pathname,
        }
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completado:', {
          url: blob.url,
          pathname: blob.pathname,
          tokenPayload,
        })
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (error) {
    console.error('Error uploading file:', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Error al subir archivo',
      },
      { status: 500 }
    )
  }
}