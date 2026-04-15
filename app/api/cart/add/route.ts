import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Size } from '@prisma/client'

function isLockedDrop(product: {
  status: string
  releaseAt: Date | null
}) {
  if (product.status !== 'COMING_SOON') return false
  if (!product.releaseAt) return true
  return product.releaseAt.getTime() > Date.now()
}

export async function POST(request: Request) {
  const user = await getCurrentUser()

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { productId, quantity = 1, size = null } = await request.json()

    const safeQuantity = Math.max(1, Number(quantity) || 1)

    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { sizes: true },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    if (product.status === 'INACTIVE') {
      return NextResponse.json(
        { error: 'Producto no disponible' },
        { status: 400 }
      )
    }

    if (isLockedDrop(product)) {
      return NextResponse.json(
        {
          error: 'Este producto pertenece a un proximo drop y aun no se puede comprar',
        },
        { status: 400 }
      )
    }

    let cart = await prisma.cart.findUnique({
      where: { userId: user.id },
    })

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: user.id },
      })
    }

    const existingItem = await prisma.cartItem.findUnique({
      where: {
        cartId_productId_size: {
          cartId: cart.id,
          productId,
          size,
        },
      },
    })

    const finalQuantity = (existingItem?.quantity || 0) + safeQuantity

    if (size) {
      const sizeData = product.sizes.find((s) => s.size === size)

      if (!sizeData) {
        return NextResponse.json(
          { error: 'La talla seleccionada no existe' },
          { status: 400 }
        )
      }

      if (sizeData.stock < finalQuantity) {
        return NextResponse.json(
          {
            error: `Solo hay ${sizeData.stock} unidades disponibles en talla ${size}`,
          },
          { status: 400 }
        )
      }
    } else if (product.stock < finalQuantity) {
      return NextResponse.json(
        {
          error: `Solo hay ${product.stock} unidades disponibles`,
        },
        { status: 400 }
      )
    }

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: finalQuantity },
      })
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity: safeQuantity,
          size: size ? (size as Size) : null,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding to cart:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error al agregar al carrito',
      },
      { status: 500 }
    )
  }
}