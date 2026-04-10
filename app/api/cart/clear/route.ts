// app/api/cart/clear/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST() {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    })

    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error clearing cart:', error)
    return NextResponse.json(
      { error: 'Error al vaciar el carrito' },
      { status: 500 }
    )
  }
}
