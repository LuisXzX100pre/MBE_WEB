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
import { ArrowRight, Flame, Sparkles } from 'lucide-react'
import { DROP_FIXED_DAYS, getDropWindowEndDate, isWithinDropWindow } from '@/lib/drop'

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

function formatDropDate(value?: string | Date | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function DropHero({
  mode,
  product,
}: {
  mode: 'upcoming' | 'live'
  product: NonNullable<
    Awaited<ReturnType<typeof getNextDrop>> | Awaited<ReturnType<typeof getRecentlyReleasedDrop>>
  >
}) {
  const releaseLabel = formatDropDate(product.releaseAt)
  const fixedUntil = getDropWindowEndDate(product.releaseAt)
  const fixedUntilLabel = formatDropDate(fixedUntil)

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#0f0f10] via-[#171717] to-[#0a0a0a] shadow-[0_25px_90px_rgba(0,0,0,0.35)] sm:rounded-[32px] lg:rounded-[38px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20" />

        <div className="relative grid min-h-[480px] items-center gap-8 px-4 py-5 sm:min-h-[560px] sm:px-6 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 xl:px-12">
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 sm:text-xs">
                {mode === 'upcoming' ? 'Proximo drop' : 'Nuevo drop disponible'}
              </span>

              {product.dropName && (
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/75 sm:text-xs">
                  {product.dropName}
                </span>
              )}
            </div>

            <h1 className="max-w-3xl text-3xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.4rem]">
              {mode === 'upcoming'
                ? product.dropName || product.name
                : `${product.dropName || product.name} YA DISPONIBLE`}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base md:text-lg">
              {mode === 'upcoming'
                ? product.description?.trim() ||
                  `${product.name} de ${product.category.name} se mantendra fijo en home hasta su lanzamiento.`
                : product.description?.trim() ||
                  `El nuevo drop ya salio y se quedara fijo en home durante ${DROP_FIXED_DAYS} dias para destacarlo como lanzamiento principal.`}
            </p>

            {releaseLabel && (
              <p className="mt-5 text-sm font-medium text-white/80 sm:text-base">
                {mode === 'upcoming'
                  ? `Lanzamiento: ${releaseLabel}`
                  : `Estreno del drop: ${releaseLabel}`}
              </p>
            )}

            {mode === 'live' && fixedUntilLabel && (
              <p className="mt-2 text-sm text-white/55">
                Fijo en home hasta: {fixedUntilLabel}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={`/productos/${product.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 sm:px-6"
              >
                {mode === 'upcoming' ? 'Ver drop' : 'Comprar ahora'}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/productos"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 sm:px-6"
              >
                Ver todos los productos
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[24px] sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-xs">
                  Estado
                </p>
                <p className="mt-3 flex items-center gap-2 text-lg font-black text-white sm:text-xl">
                  {mode === 'upcoming' ? <Sparkles className="h-5 w-5" /> : <Flame className="h-5 w-5" />}
                  {mode === 'upcoming' ? 'Preparando estreno' : 'En lanzamiento'}
                </p>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[24px] sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-xs">
                  Categoria
                </p>
                <p className="mt-3 text-lg font-black text-white sm:text-xl">
                  {product.category.name}
                </p>
              </div>

              <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[24px] sm:p-5">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-xs">
                  Precio
                </p>
                <p className="mt-3 text-lg font-black text-white sm:text-xl">
                  ${product.price.toFixed(2)} MXN
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center">
            {mode === 'upcoming' ? (
              <div className="w-full max-w-2xl">
                <DropCountdown
                  targetDate={new Date(product.releaseAt!).toISOString()}
                  title={product.dropName || product.name}
                  subtitle="Cuenta regresiva oficial del siguiente drop. Cuando termine, el lanzamiento entra en promocion fija durante 3 dias."
                />
              </div>
            ) : product.images[0]?.url ? (
              <div className="relative h-[280px] w-full overflow-hidden rounded-[22px] border border-white/10 bg-black/30 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:h-[360px] sm:rounded-[28px] md:h-[420px] lg:h-[450px]">
                <Image
                  src={product.images[0].url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/10 bg-black/55 p-4 backdrop-blur-xl sm:inset-x-5 sm:bottom-5 sm:p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55 sm:text-xs">
                    Nuevo drop
                  </p>
                  <p className="mt-2 text-xl font-black text-white sm:text-2xl">
                    {product.name}
                  </p>
                  <p className="mt-2 text-sm text-white/65">
                    Disponible ahora mismo en la tienda.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm">
                    MBE
                  </p>
                  <p className="mt-3 text-xl font-black text-white sm:text-2xl">
                    New Drop
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm">
                    Estado
                  </p>
                  <p className="mt-3 text-xl font-black text-white sm:text-2xl">
                    Disponible
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm">
                    Categoria
                  </p>
                  <p className="mt-3 text-xl font-black text-white sm:text-2xl">
                    {product.category.name}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm">
                    Marca
                  </p>
                  <p className="mt-3 text-xl font-black text-white sm:text-2xl">
                    MBE
                  </p>
                </div>
              </div>
            )}
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
                <DropHero mode="upcoming" product={nextDrop} />
              ) : homeMode === 'live-drop' && recentDrop ? (
                <DropHero mode="live" product={recentDrop} />
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
