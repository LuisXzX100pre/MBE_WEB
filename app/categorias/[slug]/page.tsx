// app/categorias/[slug]/page.tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductCard } from '@/components/store/product-card'
import { prisma } from '@/lib/prisma'
import { ArrowLeft } from 'lucide-react'

async function getCategoryWithProducts(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: { status: 'ACTIVE' },
        include: {
          images: { orderBy: { order: 'asc' } },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  return category
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = await getCategoryWithProducts(slug)

  if (!category) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/categorias"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver a categorias
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold">{category.name}</h1>
            <p className="text-muted-foreground mt-2">
              {category.products.length} productos
            </p>
          </div>

          {category.products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                No hay productos en esta categoria aun.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
