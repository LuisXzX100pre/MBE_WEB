// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim()

  if (!secret) {
    throw new Error('Falta JWT_SECRET en variables de entorno')
  }

  if (secret.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres')
  }

  return new TextEncoder().encode(secret)
}

const JWT_SECRET = getJwtSecret()

type MiddlewareSession = {
  userId?: string
  role?: 'ADMIN' | 'CLIENTE'
  username?: string
}

async function getSessionFromRequest(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as MiddlewareSession
  } catch {
    return null
  }
}

function buildLoginRedirect(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search || ''}`

  if (nextPath && nextPath !== '/login') {
    loginUrl.searchParams.set('next', nextPath)
  }

  return loginUrl
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')
  const isPrivatePage =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/mis-pedidos') ||
    pathname.startsWith('/cuenta') ||
    pathname.startsWith('/perfil')

  if (!isAdminPage && !isAdminApi && !isPrivatePage) {
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)

  if (!session?.userId) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    return NextResponse.redirect(buildLoginRedirect(request))
  }

  if (isAdminPage || isAdminApi) {
    if (session.role !== 'ADMIN') {
      if (isAdminApi) {
        return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })
      }

      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/api/admin/:path*',
    '/checkout/:path*',
    '/mis-pedidos/:path*',
    '/cuenta/:path*',
    '/perfil/:path*',
  ],
}