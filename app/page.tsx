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
    take: 8,
    orderBy: { createdAt: 'desc' },
  })
}

async function getCategories() {
  return prisma.category.findMany({
    include: {
      _count: { select: { products: true } },
    },
  })
}

async function getNextDrop() {
  return prisma.product.findFirst({
    where: {
      status: 'COMING_SOON',
      releaseAt: {
        not: null,
        gte: new Date(),
      },
    },
    select: {
      id: true,
      name: true,
      dropName: true,
      releaseAt: true,
      category: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      releaseAt: 'asc',
    },
  })
}

function formatDropSubtitle(name: string, categoryName: string) {
  return `${name} de ${categoryName} estara disponible cuando termine el contador.`
}

export default async function HomePage() {
  const [products, categories, nextDrop] = await Promise.all([
    getFeaturedProducts(),
    getCategories(),
    getNextDrop(),
  ])

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main
        className="flex-1"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}
      >
        <section
          className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden bg-gradient-to-b from-card to-background px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-muted/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />

          <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center text-center">
            <div className="mb-5 sm:mb-7">
              <Image
                src="/logo.png"
                alt="MBE Logo"
                width={340}
                height={160}
                className="mx-auto h-16 w-auto object-contain sm:h-20 md:h-28 lg:h-36"
                priority
              />
            </div>

            <p className="mb-7 max-w-2xl text-lg text-muted-foreground sm:text-xl md:mb-8 md:text-2xl">
              "MBE Es para todos, Pero no para cualquiera."
            </p>

            {nextDrop ? (
              <DropCountdown
                targetDate={nextDrop.releaseAt!.toISOString()}
                title={nextDrop.dropName || nextDrop.name}
                subtitle={formatDropSubtitle(
                  nextDrop.name,
                  nextDrop.category.name
                )}
              />
            ) : (
              <div className="mx-auto w-full max-w-3xl rounded-[32px] border border-white/10 bg-white/[0.035] px-6 py-6 text-center shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                <p className="text-sm uppercase tracking-[0.35em] text-white/55">
                  MBE
                </p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-white md:text-5xl">
                  NUEVA COLECCION
                </h2>
                <p className="mt-3 text-white/60">
                  Muy pronto se anunciara el siguiente drop.
                </p>
              </div>
            )}

            <Link
              href="/productos"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:px-8 sm:py-4 sm:text-base"
            >
              Ver coleccion
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
            <h2 className="mb-8 text-2xl font-bold md:text-3xl">Categorias</h2>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-muted-foreground"
                >
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <div className="text-center">
                      <h3 className="text-base font-bold transition-transform group-hover:scale-110 sm:text-lg">
                        {category.name}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                        {category._count.products} productos
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <div className="mb-8 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-bold md:text-3xl">Ultimos productos</h2>

            <Link
              href="/productos"
              className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <p className="text-muted-foreground">
                No hay productos disponibles aun.
              </p>
            </div>
          )}
        </section>

        <CommunitySection />
      </main>

      <Footer />
    </div>
  )
}