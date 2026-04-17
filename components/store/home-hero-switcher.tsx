'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DropCountdown } from '@/components/store/drop-countdown'
import { HomeHeroCarousel, type HomeHeroSlide } from '@/components/store/home-hero-carousel'

type DropProduct = {
  id: string
  name: string
  description: string | null
  dropName: string | null
  price: number
  releaseAt: Date | string | null
  category: {
    name: string
    slug: string
  }
  images: {
    url: string
  }[]
}

type Props = {
  nextDrop: DropProduct | null
  recentDrop: DropProduct | null
  heroSlides: HomeHeroSlide[]
}

function LiveDropFixedHero({ product }: { product: DropProduct }) {
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
              {product.description?.trim() || 'Nuevo drop ya disponible.'}
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

function DropReleaseOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-all duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[4px]" />
      <div
        className={`relative flex h-[220px] w-[220px] items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_0_120px_rgba(255,255,255,0.18)] transition-all duration-700 sm:h-[280px] sm:w-[280px] ${
          visible ? 'scale-100' : 'scale-75'
        }`}
      >
        <div className="absolute inset-0 rounded-full border border-white/20 animate-ping" />
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.38em] text-white/70 sm:text-xs">
            DROP LIVE
          </p>
          <h3 className="mt-3 text-3xl font-black text-white sm:text-5xl">
            YA SALIÓ
          </h3>
        </div>
      </div>
    </div>
  )
}

export function HomeHeroSwitcher({ nextDrop, recentDrop, heroSlides }: Props) {
  const router = useRouter()
  const [countdownFinished, setCountdownFinished] = useState(false)
  const [showReleaseAnimation, setShowReleaseAnimation] = useState(false)
  const alreadyTriggeredRef = useRef(false)

  const mode = useMemo(() => {
    if (nextDrop && !countdownFinished) return 'upcoming-drop'
    if (recentDrop) return 'live-drop'
    return 'carousel'
  }, [nextDrop, recentDrop, countdownFinished])

  const handleCountdownExpire = useCallback(async () => {
    if (alreadyTriggeredRef.current) return
    alreadyTriggeredRef.current = true

    setShowReleaseAnimation(true)

    try {
      const audio = new Audio('/sounds/drop-fall.mp3')
      audio.volume = 1
      await audio.play()
    } catch {
      // si el navegador bloquea autoplay, no rompemos nada
    }

    setTimeout(() => {
      setCountdownFinished(true)
      router.refresh()
    }, 1700)

    setTimeout(() => {
      setShowReleaseAnimation(false)
    }, 2600)
  }, [router])

  return (
    <div className="relative flex w-full flex-1">
      <DropReleaseOverlay visible={showReleaseAnimation} />

      {mode === 'upcoming-drop' && nextDrop ? (
        <div className="flex w-full flex-1 items-center justify-center">
          <div className="mx-auto flex w-full max-w-[1500px] items-center justify-center px-2 py-8 sm:px-4 md:px-6 lg:px-8">
            <DropCountdown
              targetDate={new Date(nextDrop.releaseAt!).toISOString()}
              title={nextDrop.dropName || nextDrop.name}
              ctaHref={`/productos/${nextDrop.id}`}
              ctaLabel="Ver drop"
              onExpire={handleCountdownExpire}
            />
          </div>
        </div>
      ) : mode === 'live-drop' && recentDrop ? (
        <LiveDropFixedHero product={recentDrop} />
      ) : (
        <HomeHeroCarousel slides={heroSlides} />
      )}
    </div>
  )
}