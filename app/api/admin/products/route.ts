// app/api/admin/products/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isAdmin } from '@/lib/auth'

interface SizeInput {
  size: 'S' | 'M' | 'L' | 'XL'
  stock: number
}

export async function POST(request: Request) {
  const admin = await isAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const { name, description, price, stock, categoryId, status, images, sizes } =
      await request.json()

    const product = await prisma.product.create({
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
    console.error('Error creating product:', error)
    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    )
  }
}
