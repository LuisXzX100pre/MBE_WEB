// app/api/cart/remove/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { productId, size } = await request.json()

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    })

    if (!cart) {
      return NextResponse.json({ success: true })
    }

    // Eliminar item especifico con productId y size
    await prisma.cartItem.deleteMany({
      where: {
        cartId: cart.id,
        productId,
        size: size || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from cart:', error)
    return NextResponse.json(
      { error: 'Error al eliminar del carrito' },
      { status: 500 }
    )
  }
}
