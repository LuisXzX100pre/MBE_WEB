// app/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductCard } from '@/components/store/product-card'
import { CommunitySection } from '@/components/store/community-section'
import { DropCountdown } from '@/components/store/drop-countdown'
import { prisma } from '@/lib/prisma'
import { ArrowRight } from 'lucide-react'

async function getFeaturedProducts() {
  const products = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
    },
    take: 8,
    orderBy: { createdAt: 'desc' },
  })
  return products
}

async function getCategories() {
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { products: true } },
    },
  })
  return categories
}

export default async function HomePage() {
  const products = await getFeaturedProducts()
  const categories = await getCategories()

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="relative h-[80vh] flex items-center justify-center bg-gradient-to-b from-card to-background overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-muted/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20" />

          <div className="relative text-center px-4 max-w-5xl mx-auto">
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="MBE Logo"
                width={300}
                height={150}
                className="object-contain mx-auto h-24 md:h-32 lg:h-40 w-auto"
                priority
              />
            </div>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8">
              "MBE Es para todos, Pero no para cualquiera."
            </p>

            <DropCountdown
              targetDate="2026-04-30T20:00:00"
              title="NUEVA COLECCION MBE"
              subtitle="Disponible muy pronto. Prepárate para el siguiente lanzamiento."
            />

            <Link
              href="/productos"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-medium rounded-full hover:opacity-90 transition-opacity"
            >
              Ver coleccion
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        {/* Categories Section */}
        {categories.length > 0 && (
          <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-8">Categorias</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="group relative aspect-square bg-card rounded-lg border border-border overflow-hidden hover:border-muted-foreground transition-colors"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <h3 className="font-bold text-lg group-hover:scale-110 transition-transform">
                        {category.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {category._count.products} productos
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Products Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">Ultimos productos</h2>
            <Link
              href="/productos"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              Ver todos
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">
                No hay productos disponibles aun.
              </p>
            </div>
          )}
        </section>

        {/* CTA Section - Comunidad MBE */}
        <CommunitySection />
      </main>

      <Footer />
    </div>
  )
}