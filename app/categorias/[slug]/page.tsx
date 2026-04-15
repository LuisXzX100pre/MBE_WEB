import { notFound } from 'next/navigation'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductCard } from '@/components/store/product-card'
import { prisma } from '@/lib/prisma'

async function getCategory(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      products: {
        where: {
          status: {
            in: ['ACTIVE', 'COMING_SOON'],
          },
        },
        include: {
          images: { orderBy: { order: 'asc' } },
          category: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const category = await getCategory(slug)

  if (!category) {
    notFound()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Categoria
            </p>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              {category.name}
            </h1>
            <p className="mt-3 text-muted-foreground">
              {category.products.length} producto(s)
            </p>
          </div>

          {category.products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {category.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">
                No hay productos disponibles en esta categoria.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}