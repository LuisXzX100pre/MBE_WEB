// app/admin/productos/page.tsx
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Plus } from 'lucide-react'
import { ProductsTable } from '@/components/admin/products-table'

async function getProducts() {
  const products = await prisma.product.findMany({
    include: {
      category: true,
      images: { orderBy: { order: 'asc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  })
  return products
}

export default async function AdminProductsPage() {
  const products = await getProducts()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Productos</h1>
        <Link
          href="/admin/productos/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-5 h-5" />
          Nuevo producto
        </Link>
      </div>

      <ProductsTable products={products} />
    </div>
  )
}
