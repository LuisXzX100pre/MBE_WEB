import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { parseProductInput, saveProductColors, ProductEditConflict, ProductNotFound } from '@/lib/admin/product-input'
import { productTransaction, syncProductStock } from '@/lib/product-transactions'
import { productColorsInclude } from '@/lib/product-queries'
import { ProductSelectionError } from '@/lib/product-variants'

function failure(error: unknown) {
  console.error('[admin:products]', error)
  return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el producto' }, { status: error instanceof ProductSelectionError || error instanceof ProductEditConflict || error instanceof ProductNotFound ? error.status : 500 })
}
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const input = parseProductInput(await request.json())
    if (!await prisma.category.findUnique({ where: { id: input.data.categoryId }, select: { id: true } })) return NextResponse.json({ error: 'La categoria seleccionada no existe' }, { status: 404 })
    const product = await productTransaction(async tx => {
      if (input.colors?.some(color => color.id)) throw new ProductSelectionError('Los colores nuevos no deben incluir ID')
      const created = await tx.product.create({ data: { ...input.data, stock: input.stock, images: { create: input.images.map((url, order) => ({ url, order })) }, sizes: { create: input.sizes } } })
      const id = created.id
      await saveProductColors(tx, id, input.colors)
      await syncProductStock(tx, id)
      return tx.product.findUniqueOrThrow({ where: { id }, include: { images: { orderBy: { order: 'asc' } }, sizes: true, category: true, colors: productColorsInclude } })
    })
    return NextResponse.json(product, { status: 201 })
  } catch (error) { return failure(error) }
}
