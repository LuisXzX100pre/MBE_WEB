// app/admin/productos/nuevo/page.tsx
import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/admin/product-form'

async function getCategories() {
  const categories = await prisma.category.findMany()
  return categories
}

export default async function NewProductPage() {
  const categories = await getCategories()

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Nuevo producto</h1>
      <ProductForm categories={categories} />
    </div>
  )
}
