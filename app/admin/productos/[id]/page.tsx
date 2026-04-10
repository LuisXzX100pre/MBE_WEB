// app/admin/productos/[id]/page.tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/admin/product-form'

async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { 
      images: { orderBy: { order: 'asc' } },
      sizes: true,
    },
  })
  return product
}

async function getCategories() {
  const categories = await prisma.category.findMany()
  return categories
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [product, categories] = await Promise.all([
    getProduct(id),
    getCategories(),
  ])

  if (!product) {
    notFound()
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Editar producto</h1>
      <ProductForm product={product} categories={categories} />
    </div>
  )
}
