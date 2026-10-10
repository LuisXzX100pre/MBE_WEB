import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CategoryError, categoryApi, categoryBody } from '@/lib/admin/categories'

type Context = { params: { id: string } | Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Context) {
  return categoryApi(request, async () => {
    const { id } = await params
    if (!id) throw new CategoryError('La categoría es obligatoria.')
    const data = await categoryBody(request)
    const category = await prisma.category.update({
      where: { id }, data, include: { _count: { select: { products: true } } },
    })
    return NextResponse.json({ category })
  })
}

// Preserve existing clients while the admin manager now uses PATCH.
export const PUT = PATCH

export async function DELETE(request: Request, { params }: Context) {
  return categoryApi(request, async () => {
    const { id } = await params
    if (!id) throw new CategoryError('La categoría es obligatoria.')
    await prisma.$transaction(async tx => {
      const category = await tx.category.findUnique({
        where: { id }, include: { _count: { select: { products: true } } },
      })
      if (!category) throw new CategoryError('La categoría no existe.', 404)
      if (category._count.products !== 0) throw new CategoryError('No puedes eliminar esta categoría porque tiene productos asociados.', 409)
      // The required Product.category FK also rejects a concurrent product insert.
      await tx.category.delete({ where: { id } })
    })
    return NextResponse.json({ success: true })
  })
}
