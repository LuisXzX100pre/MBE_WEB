import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { mutateCart } from '@/lib/cart-mutations'
import { ProductSelectionError } from '@/lib/product-variants'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProductSelectionError('Solicitud inválida')
    await mutateCart(user.id, body, 'remove')
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo actualizar el carrito' }, { status: error instanceof ProductSelectionError ? 400 : 500 })
  }
}
