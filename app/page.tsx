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
import { DropCountdown } from '@/components/store/drop-countdown'
import { prisma } from '@/lib/prisma'
import { ArrowRight } from 'lucide-react'
import { DROP_FIXED_DAYS, isWithinDropWindow } from '@/lib/drop'

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
      title: 'NUEVA COLECCION',
      subtitle:
        'Descubre nuestras piezas, proximos drops y productos destacados de la marca.',
      ctaHref: '/productos',
      ctaLabel: 'Explorar ahora',
    })
  }

  return slides
}

function UpcomingDropOnlyCountdown({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getNextDrop>>>
}) {
  return (
    <div className="flex w-full flex-1 items-center justify-center">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-center px-2 py-8 sm:px-4 md:px-6 lg:px-8">
        <DropCountdown
          targetDate={new Date(product.releaseAt!).toISOString()}
          title={product.dropName || product.name}
        />
      </div>
    </div>
  )
}

function LiveDropFixedHero({
  product,
}: {
  product: NonNullable<Awaited<ReturnType<typeof getRecentlyReleasedDrop>>>
}) {
  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#0f0f10] via-[#171717] to-[#0a0a0a] shadow-[0_25px_90px_rgba(0,0,0,0.35)] sm:rounded-[32px] lg:rounded-[38px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

        <div className="relative grid min-h-[420px] items-center gap-8 px-4 py-6 sm:min-h-[500px] sm:px-6 md:min-h-[560px] md:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 xl:min-h-[560px] xl:px-12">
          <div className="order-2 flex flex-col justify-center lg:order-1">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 sm:text-xs">
                Nuevo drop
              </span>

              {product.dropName && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 sm:text-xs">
                  {product.dropName}
                </span>
              )}
            </div>

            <h1 className="max-w-3xl text-3xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.4rem]">
              {product.dropName || product.name}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base md:text-lg">
              {product.description?.trim() ||
                `Este drop se mantiene fijo en home durante ${DROP_FIXED_DAYS} dias despues de su estreno.`}
            </p>

            <div className="mt-6">
              <Link
                href={`/productos/${product.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 sm:px-6"
              >
                Ver drop
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="order-1 flex items-center justify-center lg:order-2">
            <div className="relative h-[260px] w-full overflow-hidden rounded-[22px] border border-white/10 bg-black/30 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:h-[320px] sm:rounded-[28px] md:h-[380px] lg:h-[450px]">
              {product.images[0]?.url ? (
                <>
                  <Image
                    src={product.images[0].url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-center text-white/55">
                  Sin imagen principal
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function HomePage() {
  const [products, promoProducts, categories, nextDrop, recentDrop] = await Promise.all([
    getFeaturedProducts(),
    getPromoProducts(),
    getCategories(),
    getNextDrop(),
    getRecentlyReleasedDrop(),
  ])

  const heroSlides = buildHeroSlides(promoProducts)

  const homeMode: 'upcoming-drop' | 'live-drop' | 'carousel' = nextDrop
    ? 'upcoming-drop'
    : recentDrop
      ? 'live-drop'
      : 'carousel'

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main
        className="flex-1"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)' }}
      >
        <section
          className="relative overflow-hidden bg-gradient-to-b from-card to-background px-3 pt-1 pb-6 sm:px-4 sm:pt-2 sm:pb-8 md:px-6 lg:px-8"
          style={{ minHeight: 'calc(100svh - 4rem)' }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-muted/20 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:42px_42px] opacity-20" />

          <div className="relative mx-auto flex h-full w-full max-w-[1700px] flex-col">
            <div className="flex flex-col items-center pt-1 sm:pt-2">
              <Image
                src="/logo.png"
                alt="MBE Logo"
                width={340}
                height={160}
                className="mx-auto h-14 w-auto object-contain sm:h-16 md:h-20"
                priority
              />

              <p className="mt-2 mb-4 max-w-3xl text-center text-base text-muted-foreground sm:mt-3 sm:mb-5 sm:text-lg md:text-2xl">
                "MBE Es para todos, Pero no para cualquiera."
              </p>
            </div>

            <div className="flex flex-1">
              {homeMode === 'upcoming-drop' && nextDrop ? (
                <UpcomingDropOnlyCountdown product={nextDrop} />
              ) : homeMode === 'live-drop' && recentDrop ? (
                <LiveDropFixedHero product={recentDrop} />
              ) : (
                <HomeHeroCarousel slides={heroSlides} />
              )}
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
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
            <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
              Aun no hay productos publicados.
            </div>
          )}
        </section>

        <CommunitySection />
      </main>

      <Footer />
    </div>
  )
}