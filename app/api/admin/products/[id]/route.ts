import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ProductStatus, Size } from '@prisma/client'

const SIZES: Size[] = ['S', 'M', 'L', 'XL']

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

function normalizeDropName(value: unknown) {
  const parsed = String(value || '').trim()
  return parsed.length > 0 ? parsed : null
}

function normalizeReleaseAt(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('La fecha de lanzamiento no es valida')
  }
  return parsed
}

function normalizeSizes(input: unknown) {
  const incoming = Array.isArray(input) ? input : []

  return SIZES.map((size) => {
    const found = incoming.find((item) => item?.size === size)
    return {
      size,
      stock: Math.max(0, Number(found?.stock) || 0),
    }
  })
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()

    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()

    const name = String(body.name || '').trim()
    const description = String(body.description || '').trim() || null
    const price = Number(body.price)
    const categoryId = String(body.categoryId || '').trim()
    const status = normalizeStatus(body.status)
    const dropName = normalizeDropName(body.dropName)
    const releaseAt = normalizeReleaseAt(body.releaseAt)
    const images = Array.isArray(body.images)
      ? body.images.map((url: unknown) => String(url).trim()).filter(Boolean)
      : []
    const sizes = normalizeSizes(body.sizes)
    const totalStock = sizes.reduce((sum, item) => sum + item.stock, 0)

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

    const product = await prisma.product.create({
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
          create: images.map((url, index) => ({
            url,
            order: index,
          })),
        },
        sizes: {
          create: sizes.map((item) => ({
            size: item.size,
            stock: item.stock,
          })),
        },
      },
      include: {
        images: { orderBy: { order: 'asc' } },
        sizes: true,
        category: true,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('[admin:products:create]', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'No se pudo crear el producto',
      },
      { status: 500 }
    )
  }
}