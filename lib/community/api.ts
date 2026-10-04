import 'server-only'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/auth'
import { CommunityError } from './validation'
export async function member(request?: Request, admin = false) {
  if (request && !['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin')
    if (origin && origin !== new URL(request.url).origin) throw new CommunityError('Origen no permitido', 403)
  }
  const user = await getCurrentUser()
  if (!user) throw new CommunityError('Inicia sesion para continuar', 401)
  if (admin && user.role !== 'ADMIN') throw new CommunityError('Acceso denegado', 403)
  return user
}
export async function api(work: () => Promise<unknown>) {
  try { return NextResponse.json(await work(), { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch (error) {
    if (error instanceof CommunityError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
      if (error.code === 'P2002') return NextResponse.json({ error: 'El registro ya existe' }, { status: 409 })
      if (error.code === 'P2034') return NextResponse.json({ error: 'Solicitud concurrente. Intenta nuevamente.' }, { status: 409 })
    }
    console.error('[community]', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: 'No se pudo completar la solicitud' }, { status: 500 })
  }
}
