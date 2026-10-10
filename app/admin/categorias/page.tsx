// app/admin/categorias/page.tsx
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CategoriesManager } from '@/components/admin/categories-manager'

async function getCategories() {
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } },
    },
    orderBy: { name: 'asc' },
  })
  return categories
}

export default async function AdminCategoriesPage() {
  if (!await isAdmin()) redirect('/')
  const categories = await getCategories()

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Categorías</h1>
      <CategoriesManager categories={categories} />
    </div>
  )
}
