import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import type { ProductStatus, Size } from '@prisma/client'

const SIZES: Size[] = ['S', 'M', 'L', 'XL']

type RouteContext = {
  params: Promise<{
    id: string
  }>
}

type NormalizedSize = {
  size: Size
  stock: number
}

type IncomingSize = {
  size?: unknown
  stock?: unknown
}

function normalizeStatus(value: unknown): ProductStatus {
  if (
    value === 'ACTIVE' ||
    value === 'COMING_SOON' ||
    value === 'INACTIVE'
  ) {
    return value
  }

  return 'ACTIVE'
}

function normalizeDropName(value: unknown): string | null {
  const parsed = String(value || '').trim()
  return parsed.length > 0 ? parsed : null
}

function normalizeReleaseAt(value: unknown): Date | null {
  if (!value) return null

  const parsed = new Date(String(value))

  if (Number.isNaN(parsed.getTime())) {
    throw new Error('La fecha de lanzamiento no es valida')
  }

  return parsed
}

function normalizeImages(input: unknown): string[] {
  if (!Array.isArray(input)) return []

  return input
    .map((url: unknown) => String(url || '').trim())
    .filter((url: string): url is string => url.length > 0)
}

function normalizeSizes(input: unknown): NormalizedSize[] {
  const incoming: IncomingSize[] = Array.isArray(input)
    ? input.filter((item: unknown): item is IncomingSize => {
        return typeof item === 'object' && item !== null
      })
    : []

  return SIZES.map((size: Size) => {
    const found = incoming.find((item: IncomingSize) => item.size === size)

    return {
      size,
      stock: Math.max(0, Number(found?.stock) || 0),
    }
  })
}

function normalizeName(value: unknown): string {
  return String(value || '').trim()
}

function normalizeDescription(value: unknown): string | null {
  const parsed = String(value || '').trim()
  return parsed.length > 0 ? parsed : null
}

function normalizeCategoryId(value: unknown): string {
  return String(value || '').trim()
}

function normalizePrice(value: unknown): number {
  return Number(value)
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'El ID del producto es requerido' },
        { status: 400 }
      )
    }

    const body: unknown = await request.json()

    if (typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'El cuerpo de la solicitud es invalido' },
        { status: 400 }
      )
    }

    const payload = body as Record<string, unknown>

    const name = normalizeName(payload.name)
    const description = normalizeDescription(payload.description)
    const price = normalizePrice(payload.price)
    const categoryId = normalizeCategoryId(payload.categoryId)
    const status = normalizeStatus(payload.status)
    const dropName = normalizeDropName(payload.dropName)
    const releaseAt = normalizeReleaseAt(payload.releaseAt)
    const images = normalizeImages(payload.images)
    const sizes = normalizeSizes(payload.sizes)
    const totalStock = sizes.reduce(
      (sum: number, item: NormalizedSize) => sum + item.stock,
      0
    )

    if (!name) {
      return NextResponse.json(
        { error: 'El nombre es requerido' },
        { status: 400 }
      )
    }

    if (!categoryId) {
      return NextResponse.json(
        { error: 'La categoria es requerida' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json(
        { error: 'El precio es invalido' },
        { status: 400 }
      )
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: 'Debes subir al menos una imagen' },
        { status: 400 }
      )
    }

    if (status === 'COMING_SOON' && !releaseAt) {
      return NextResponse.json(
        { error: 'Debes definir una fecha para un producto proximo drop' },
        { status: 400 }
      )
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'El producto no existe' },
        { status: 404 }
      )
    }

    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    })

    if (!existingCategory) {
      return NextResponse.json(
        { error: 'La categoria seleccionada no existe' },
        { status: 404 }
      )
    }

    const product = await prisma.$transaction(async (tx) => {
      await tx.productImage.deleteMany({
        where: { productId: id },
      })

      await tx.productSize.deleteMany({
        where: { productId: id },
      })

      return tx.product.update({
        where: { id },
        data: {
          name,
          description,
          price,
          stock: totalStock,
          categoryId,
          status,
          dropName,
          releaseAt,
          images: {
            create: images.map((url: string, index: number) => ({
              url,
              order: index,
            })),
          },
          sizes: {
            create: sizes.map((item: NormalizedSize) => ({
              size: item.size,
              stock: item.stock,
            })),
          },
        },
        include: {
          images: {
            orderBy: {
              order: 'asc',
            },
          },
          sizes: true,
          category: true,
        },
      })
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('[admin:products:update]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo actualizar el producto',
      },
      { status: 500 }
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id } = await context.params

    if (!id) {
      return NextResponse.json(
        { error: 'El ID del producto es requerido' },
        { status: 400 }
      )
    }

    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'El producto no existe' },
        { status: 404 }
      )
    }

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({
        where: { productId: id },
      })

      await tx.orderItem.deleteMany({
        where: { productId: id },
      })

      await tx.productImage.deleteMany({
        where: { productId: id },
      })

      await tx.productSize.deleteMany({
        where: { productId: id },
      })

      await tx.product.delete({
        where: { id },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin:products:delete]', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo eliminar el producto',
      },
      { status: 500 }
    )
  }
}