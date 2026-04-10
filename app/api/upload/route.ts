// app/api/upload/route.ts
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { isAdmin } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const admin = await isAdmin()

  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No se envio archivo' },
        { status: 400 }
      )
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no valido. Usa JPG, PNG, WEBP o GIF' },
        { status: 400 }
      )
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo es muy grande. Maximo 5MB' },
        { status: 400 }
      )
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).slice(2, 8)
    const pathname = `products/product-${timestamp}-${randomStr}.${extension}`

    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
    })

    return NextResponse.json({ url: blob.url })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Error al subir archivo' },
      { status: 500 }
    )
  }
}