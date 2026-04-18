import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductCard } from '@/components/store/product-card'
import { CommunitySection } from '@/components/store/community-section'
import { type HomeHeroSlide } from '@/components/store/home-hero-carousel'
import { HomeHeroSwitcher } from '@/components/store/home-hero-switcher'
import { prisma } from '@/lib/prisma'
import { releaseExpiredDrops } from '@/lib/release-drops'
import { ArrowRight } from 'lucide-react'
import { isWithinDropWindow } from '@/lib/drop'

export const dynamic = 'force-dynamic'

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

async function getPromoProducts() {
  return prisma.product.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      images: { orderBy: { order: 'asc' } },
      category: true,
    },
    take: 3,
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
        gt: new Date(),
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      dropName: true,
      price: true,
      releaseAt: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: { order: 'asc' },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: {
      releaseAt: 'asc',
    },
  })
}

async function getRecentlyReleasedDrop() {
  const candidates = await prisma.product.findMany({
    where: {
      status: 'ACTIVE',
      releaseAt: {
        not: null,
        lte: new Date(),
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      dropName: true,
      price: true,
      releaseAt: true,
      category: {
        select: {
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: { order: 'asc' },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: {
      releaseAt: 'desc',
    },
    take: 10,
  })

  return candidates.find((product) => isWithinDropWindow(product.releaseAt)) || null
}

function buildHeroSlides(
  promoProducts: Awaited<ReturnType<typeof getPromoProducts>>
): HomeHeroSlide[] {
  const slides: HomeHeroSlide[] = []

  for (const product of promoProducts) {
    slides.push({
      id: `promo-${product.id}`,
      type: 'promo',
      eyebrow: product.category.name,
      title: product.name,
      subtitle:
        product.description?.trim() ||
        `Descubre ${product.name} y explora la nueva propuesta de ${product.category.name}.`,
      priceText: `$${product.price.toFixed(2)} MXN`,
      image: product.images[0]?.url || null,
      ctaHref: `/productos/${product.id}`,
      ctaLabel: 'Ver producto',
    })
  }

  if (slides.length === 0) {
    slides.push({
      id: 'brand-default',
      type: 'promo',
      eyebrow: 'MBE',
      title: 'NUEVA COLECCIÓN',
      subtitle:
        'Descubre nuestras piezas, próximos drops y productos destacados de la marca.',
      ctaHref: '/productos',
      ctaLabel: 'Explorar ahora',
    })
  }

  return slides
}

export default async function HomePage() {
  await releaseExpiredDrops()

  const [products, promoProducts, categories, nextDrop, recentDrop] = await Promise.all([
    getFeaturedProducts(),
    getPromoProducts(),
    getCategories(),
    getNextDrop(),
    getRecentlyReleasedDrop(),
  ])

  const heroSlides = buildHeroSlides(promoProducts)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main
        className="flex-1"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}
      >
        <section
          className="relative overflow-hidden px-3 pb-8 pt-2 sm:px-4 sm:pb-10 sm:pt-3 md:px-6 lg:px-8"
          style={{ minHeight: 'calc(100svh - 4rem)' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-card via-background to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_26%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />
          <div className="absolute left-1/2 top-0 h-[360px] w-[360px] -translate-x-1/2 rounded-full bg-white/[0.04] blur-3xl" />

          <div className="relative mx-auto flex h-full w-full max-w-[1700px] flex-col">
            <div className="flex flex-col items-center pt-2 sm:pt-3 md:pt-4">
              <Image
                src="/logo.png"
                alt="MBE Logo"
                width={340}
                height={160}
                className="mx-auto mt-2 h-14 w-auto object-contain sm:h-16 md:h-20"
                priority
              />

              <p className="mb-5 mt-3 max-w-3xl text-center text-base text-muted-foreground sm:mb-6 sm:text-lg md:text-2xl">
                “MBE es para todos, pero no para cualquiera.”
              </p>
            </div>

            <div className="flex flex-1">
              <HomeHeroSwitcher
                nextDrop={nextDrop}
                recentDrop={recentDrop}
                heroSlides={heroSlides}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-[1700px] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.26em] text-muted-foreground sm:text-sm">
                Selección de la marca
              </p>
              <h2 className="text-2xl font-bold md:text-3xl">Últimos productos</h2>
            </div>

            <Link
              href="/productos"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-muted-foreground transition-all hover:border-white/20 hover:text-foreground"
            >
              Ver todos
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{
                    ...product,
                    releaseAt: product.releaseAt,
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-border bg-card p-10 text-center text-muted-foreground shadow-[0_18px_60px_rgba(0,0,0,0.12)]">
              Aún no hay productos publicados.
            </div>
          )}
        </section>

        {categories.length > 0 && (
          <section className="mx-auto w-full max-w-[1700px] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
            <div className="mb-8">
              <p className="mb-2 text-xs uppercase tracking-[0.26em] text-muted-foreground sm:text-sm">
                Explora la tienda
              </p>
              <h2 className="text-2xl font-bold md:text-3xl">Categorías</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/categorias/${category.slug}`}
                  className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-card p-5 shadow-[0_14px_50px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_20px_70px_rgba(0,0,0,0.18)]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.05),transparent_28%)] opacity-80" />

                  <div className="relative flex min-h-[150px] flex-col justify-between">
                    <div className="inline-flex w-fit rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                      MBE
                    </div>

                    <div className="pt-6">
                      <h3 className="text-base font-bold transition-transform duration-300 group-hover:translate-x-1 sm:text-lg">
                        {category.name}
                      </h3>
                      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
                        {category._count.products} productos
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <CommunitySection />
      </main>

      <Footer />
    </div>
  )
}