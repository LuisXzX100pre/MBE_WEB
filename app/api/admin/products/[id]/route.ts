import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { parseProductInput, saveProductColors, saveProductImages, ProductEditConflict, ProductNotFound } from '@/lib/admin/product-input'
import { productTransaction, syncProductStock } from '@/lib/product-transactions'
import { productColorsInclude } from '@/lib/product-queries'
import { ProductSelectionError } from '@/lib/product-variants'

type RouteContext = { params: Promise<{ id: string }> }
function failure(error: unknown) {
  console.error('[admin:products]', error)
  return NextResponse.json({ error: error instanceof Error ? error.message : 'No se pudo guardar el producto' }, { status: error instanceof ProductSelectionError || error instanceof ProductEditConflict || error instanceof ProductNotFound ? error.status : 500 })
}
export async function PUT(request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await context.params
    const input = parseProductInput(await request.json())
    if (!await prisma.category.findUnique({ where: { id: input.data.categoryId }, select: { id: true } })) return NextResponse.json({ error: 'La categoria seleccionada no existe' }, { status: 404 })
    const product = await productTransaction(async tx => {
      const existing = await tx.product.findUnique({ where: { id }, include: { colors: true } })
      if (!existing) throw new ProductNotFound('El producto no existe')
      if (input.expectedUpdatedAt && existing.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) throw new ProductEditConflict('El inventario o producto cambió mientras editabas. Recarga antes de guardar para conservar las ventas recientes')
      // Keep legacy inventory untouched once color variants exist or are being introduced.
      if (!existing.colors.length && input.colors?.length && await tx.orderItem.count({ where: { productId: id, size: null } })) throw new ProductEditConflict('Este producto tiene órdenes sin talla; conserva su inventario legacy y crea otro producto para colores')
      const colorMode = existing.colors.length > 0 || Boolean(input.colors?.length)
      await tx.product.update({ where: { id }, data: { ...input.data, ...(colorMode ? {} : { stock: input.stock }) } })
      await saveProductImages(tx, id, input.images)
      if (!colorMode) {
        // Stable size rows preserve historical restoration. Never silently remove an existing size.
        const currentSizes = await tx.productSize.findMany({ where: { productId: id } })
        if (currentSizes.some(row => !input.sizes.some(size => size.size === row.size))) throw new ProductEditConflict('No puedes quitar tallas existentes; establece su stock en 0')
        for (const row of input.sizes) await tx.productSize.upsert({ where: { productId_size: { productId: id, size: row.size } }, create: { productId: id, ...row }, update: { stock: row.stock } })
      }
      await saveProductColors(tx, id, input.colors)
      await syncProductStock(tx, id)
      return tx.product.findUniqueOrThrow({ where: { id }, include: { images: { orderBy: { order: 'asc' } }, sizes: true, category: true, colors: productColorsInclude } })
    })
    return NextResponse.json(product)
  } catch (error) { return failure(error) }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'ADMIN') return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    const { id } = await context.params
    await productTransaction(async tx => {
      if (!await tx.product.findUnique({ where: { id }, select: { id: true } })) throw new ProductNotFound('El producto no existe')
      if (await tx.orderItem.count({ where: { productId: id } })) throw new ProductEditConflict('Este producto tiene historial de órdenes; desactívalo en lugar de eliminarlo')
      await tx.cartItem.deleteMany({ where: { productId: id } })
      await tx.product.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  } catch (error) { return failure(error) }
}
