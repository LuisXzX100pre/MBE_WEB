import Link from 'next/link'
import Image from 'next/image'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { ProductCard } from '@/components/store/product-card'
import { CommunitySection } from '@/components/store/community-section'
import {
  HomeHeroCarousel,
  type HomeHeroSlide,
} from '@/components/store/home-hero-carousel'
import { prisma } from '@/lib/prisma'
import { ArrowRight } from 'lucide-react'

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
      dropName: true,
      releaseAt: true,
      category: {
        select: {
          name: true,
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

function buildHeroSlides(
  nextDrop: Awaited<ReturnType<typeof getNextDrop>>,
  promoProducts: Awaited<ReturnType<typeof getPromoProducts>>
): HomeHeroSlide[] {
  const slides: HomeHeroSlide[] = []

  if (nextDrop && nextDrop.releaseAt) {
    slides.push({
      id: `drop-${nextDrop.id}`,
      type: 'drop',
      eyebrow: 'Proximo drop',
      title: nextDrop.dropName || nextDrop.name,
      subtitle: `${nextDrop.name} de ${nextDrop.category.name} estara disponible cuando termine el contador.`,
      targetDate: nextDrop.releaseAt.toISOString(),
      ctaHref: `/productos/${nextDrop.id}`,
      ctaLabel: 'Ver drop',
      image: nextDrop.images[0]?.url || null,
    })
  }

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
      title: 'NUEVA COLECCION',
      subtitle:
        'Descubre nuestras piezas, proximos drops y productos destacados de la marca.',
      ctaHref: '/productos',
      ctaLabel: 'Explorar ahora',
    })
  }

  return slides
}

export default async function HomePage() {
  const [products, promoProducts, categories, nextDrop] = await Promise.all([
    getFeaturedProducts(),
    getPromoProducts(),
    getCategories(),
    getNextDrop(),
  ])

  const heroSlides = buildHeroSlides(nextDrop, promoProducts)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main
        className="flex-1"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}
      >
        <section
          className="relative overflow-hidden bg-gradient-to-b from-card to-background px-3 pt-2 pb-6 sm:px-4 sm:pt-3 sm:pb-8 md:px-6 lg:px-8"
          style={{ minHeight: 'calc(100svh - 4rem)' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-muted/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />

          <div className="relative mx-auto flex h-full w-full max-w-[1700px] flex-col">
            <div className="flex flex-col items-center pt-2 sm:pt-3">
              <Image
                src="/logo.png"
                alt="MBE Logo"
                width={340}
                height={160}
                className="mx-auto h-14 w-auto object-contain sm:h-16 md:h-20"
                priority
              />

              <p className="mt-3 mb-4 max-w-3xl text-center text-base text-muted-foreground sm:mt-4 sm:mb-5 sm:text-lg md:text-2xl">
                "MBE Es para todos, Pero no para cualquiera."
              </p>
            </div>

            <div className="flex flex-1">
              <HomeHeroCarousel slides={heroSlides} />
            </div>
          </div>
        </section>

        {categories.length > 0 && (
          <section className="mx-auto w-full max-w-[1700px] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
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

        <section className="mx-auto w-full max-w-[1700px] px-4 py-16 sm:px-6 md:py-20 lg:px-8">
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
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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