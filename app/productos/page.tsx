import Link from 'next/link'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductCard } from '@/components/store/product-card'
import { prisma } from '@/lib/prisma'

async function getProducts() {
  return prisma.product.findMany({
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
  })
}

export default async function ProductosPage() {
  const products = await getProducts()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-muted-foreground">
              Catalogo
            </p>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Productos
            </h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Explora los productos disponibles y los proximos drops.
            </p>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-border bg-card p-12 text-center">
              <p className="text-muted-foreground">
                Aun no hay productos disponibles.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground"
              >
                Volver al inicio
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}