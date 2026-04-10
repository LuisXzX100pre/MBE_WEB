// app/api/cart/update/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { productId, quantity, size } = await request.json()
    const safeQuantity = Number(quantity) || 0

    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    })

    if (!cart) {
      return NextResponse.json({ success: true })
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId,
        size: size || null,
      },
    })

    if (!cartItem) {
      return NextResponse.json({ success: true })
    }

    if (safeQuantity <= 0) {
      await prisma.cartItem.delete({
        where: { id: cartItem.id },
      })

      return NextResponse.json({ success: true })
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { sizes: true },
    })

    if (!product) {
      return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
    }

    if (size) {
      const sizeData = product.sizes.find((s) => s.size === size)

      if (!sizeData) {
        return NextResponse.json(
          { error: 'La talla seleccionada no existe' },
          { status: 400 }
        )
      }

      if (safeQuantity > sizeData.stock) {
        return NextResponse.json(
          {
            error: `Solo hay ${sizeData.stock} unidades disponibles en talla ${size}`,
          },
          { status: 400 }
        )
      }
    } else {
      if (safeQuantity > product.stock) {
        return NextResponse.json(
          {
            error: `Solo hay ${product.stock} unidades disponibles`,
          },
          { status: 400 }
        )
      }
    }

    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: { quantity: safeQuantity },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating cart:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error al actualizar el carrito',
      },
      { status: 500 }
    )
  }
}