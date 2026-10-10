import 'server-only'
import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/auth'
import { Prisma } from '@prisma/client'

export class CategoryError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

export function categoryName(value: unknown) {
  if (typeof value !== 'string') throw new CategoryError('El nombre es obligatorio.')
  if (/[\p{Cc}\p{Cf}]/u.test(value)) throw new CategoryError('El nombre no puede contener caracteres de control.')
  const name = value.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (!name) throw new CategoryError('El nombre es obligatorio.')
  if (name.length > 80) throw new CategoryError('El nombre no puede superar 80 caracteres.')
  const slug = name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (!slug) throw new CategoryError('El nombre debe incluir letras o números.')
  return { name, slug }
}

export async function categoryBody(request: Request) {
  let value: unknown
  try { value = await request.json() } catch { throw new CategoryError('La solicitud no es válida.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CategoryError('La solicitud no es válida.')
  return categoryName((value as Record<string, unknown>).name)
}

export async function categoryApi(request: Request, work: () => Promise<Response>) {
  try {
    if (!await isAdmin()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const origin = request.headers.get('origin')
    if (request.method !== 'GET' && origin && origin !== new URL(request.url).origin) {
      throw new CategoryError('Origen no autorizado.', 403)
    }
    return await work()
  } catch (error) {
    if (error instanceof CategoryError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return NextResponse.json({ error: 'Ya existe una categoría con ese nombre.' }, { status: 409 })
      if (error.code === 'P2025') return NextResponse.json({ error: 'La categoría no existe.' }, { status: 404 })
      if (error.code === 'P2003') return NextResponse.json({ error: 'No puedes eliminar esta categoría porque tiene productos asociados.' }, { status: 409 })
    }
    console.error('[admin:categories]', error)
    return NextResponse.json({ error: 'No se pudo completar la operación de categorías.' }, { status: 500 })
  }
}
