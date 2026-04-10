// app/api/upload/route.ts
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { isAdmin } from '@/lib/auth'

export async function POST(request: Request) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se envio archivo' }, { status: 400 })
    }

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no valido. Usa JPG, PNG, WEBP o GIF' },
        { status: 400 }
      )
    }

    // Validar tamaño (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'El archivo es muy grande. Maximo 5MB' },
        { status: 400 }
      )
    }

    // Crear nombre unico
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const extension = file.name.split('.').pop()
    const fileName = `product-${timestamp}-${randomStr}.${extension}`

    // Crear directorio si no existe
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    try {
      await mkdir(uploadsDir, { recursive: true })
    } catch {
      // Directory exists
    }

    // Guardar archivo
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const filePath = join(uploadsDir, fileName)
    await writeFile(filePath, buffer)

    // Retornar URL publica
    const url = `/uploads/${fileName}`

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: 'Error al subir archivo' },
      { status: 500 }
    )
  }
}
