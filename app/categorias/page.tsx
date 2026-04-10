// app/categorias/page.tsx
import Link from 'next/link'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { prisma } from '@/lib/prisma'

async function getCategories() {
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } },
    },
  })
  return categories
}

export default async function CategoriesPage() {
  const categories = await getCategories()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold">Categorias</h1>
            <p className="text-muted-foreground mt-2">
              Explora por tipo de prenda
            </p>
          </div>

          {categories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="group relative aspect-[4/3] bg-card rounded-lg border border-border overflow-hidden hover:border-muted-foreground transition-colors"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="font-bold text-2xl group-hover:scale-110 transition-transform">
                        {category.name}
                      </h3>
                      <p className="text-muted-foreground mt-2">
                        {category._count.products} productos
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                No hay categorias disponibles aun.
              </p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
