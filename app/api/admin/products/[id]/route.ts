// app/api/admin/products/[id]/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

interface SizeInput {
  size: 'S' | 'M' | 'L' | 'XL'
  stock: number
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { name, description, price, stock, categoryId, status, images, sizes } =
      await request.json()

    // Eliminar imagenes existentes
    await prisma.productImage.deleteMany({
      where: { productId: id },
    })

    // Eliminar tallas existentes
    await prisma.productSize.deleteMany({
      where: { productId: id },
    })

    // Actualizar producto con nuevas imagenes y tallas
    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price,
        stock,
        categoryId,
        status,
        images: {
          create: images.map((url: string, index: number) => ({
            url,
            order: index,
          })),
        },
        sizes: sizes ? {
          create: (sizes as SizeInput[]).filter(s => s.stock > 0).map((s) => ({
            size: s.size,
            stock: s.stock,
          })),
        } : undefined,
      },
      include: {
        sizes: true,
        images: true,
      },
    })

    return NextResponse.json({ product })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { id } = await params

    await prisma.product.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    )
  }
}
