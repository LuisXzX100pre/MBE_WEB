'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { DropCountdown } from '@/components/store/drop-countdown'
import { HomeHeroCarousel, type HomeHeroSlide } from '@/components/store/home-hero-carousel'
import { playUnlockedDropSound } from '@/lib/audio-unlock'

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

const DROP_SOUND_DURATION_MS = 10000
const DROP_REFRESH_DELAY_MS = 12000

function LiveDropFixedHero({ product }: { product: DropProduct }) {
  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#090909] via-[#101010] to-[#050505] shadow-[0_25px_90px_rgba(0,0,0,0.42)] sm:rounded-[32px] lg:rounded-[38px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_24%),radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_40%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />
        <div className="absolute inset-y-0 left-0 w-[42%] bg-gradient-to-r from-red-600/10 via-red-500/5 to-transparent blur-3xl" />

        <div className="relative grid min-h-[420px] items-center gap-8 px-4 py-6 sm:min-h-[500px] sm:px-6 md:min-h-[560px] md:px-8 lg:grid-cols-[0.95fr_1.05fr] lg:px-10 xl:min-h-[560px] xl:px-12">
          <div className="order-2 flex flex-col justify-center lg:order-1">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white shadow-[0_12px_34px_rgba(220,38,38,0.35)] sm:text-xs">
                Nuevo Drop
              </span>

              {product.dropName && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.24em] text-white/80 sm:text-xs">
                  {product.dropName}
                </span>
              )}
            </div>

            <h1 className="max-w-3xl text-3xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.4rem]">
              {product.dropName || product.name}
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/68 sm:text-base md:text-lg">
              {product.description?.trim() || 'Nuevo drop ya disponible.'}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={`/productos/${product.id}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:translate-y-[-1px] hover:opacity-95 sm:px-6"
              >
                Ver drop
                <ArrowRight className="h-4 w-4" />
              </Link>

              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">
                MBE Release
              </span>
            </div>
          </div>

          <div className="order-1 flex items-center justify-center lg:order-2">
            <div className="relative h-[260px] w-full overflow-hidden rounded-[22px] border border-white/10 bg-black/30 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:h-[320px] sm:rounded-[28px] md:h-[380px] lg:h-[450px]">
              <div className="absolute inset-0 z-10 bg-gradient-to-br from-red-500/10 via-transparent to-transparent" />
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
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-center text-white/55">
                  Sin imagen principal
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4 z-20 rounded-[1.2rem] border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  Drop estrenado
                </p>
                <p className="mt-1 text-sm font-medium text-white/90">
                  Ya disponible para compra
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DropReleaseOverlay({
  visible,
  title,
}: {
  visible: boolean
  title: string
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-700 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[8px]" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-10%] h-[170%] w-[2px] -translate-x-1/2 bg-gradient-to-b from-transparent via-red-400/80 to-transparent opacity-80 animate-pulse" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.18),transparent_36%)]" />
      </div>

      <div className="relative px-6 text-center">
        <div className="mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-full border border-red-400/20 bg-red-500/10 shadow-[0_0_120px_rgba(239,68,68,0.22)] sm:h-[300px] sm:w-[300px]">
          <div className="absolute inset-0 rounded-full border border-red-300/20 animate-ping" />
          <div className="absolute inset-[-20px] rounded-full border border-red-200/10 animate-pulse" />
          <div className="absolute inset-[-42px] rounded-full border border-red-100/5 animate-pulse" />

          <div>
            <p className="text-[11px] uppercase tracking-[0.38em] text-white/70 sm:text-xs">
              DROP LIVE
            </p>
            <h3 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              YA SALIÓ
            </h3>
          </div>
        </div>

        <h4 className="mt-8 text-3xl font-black tracking-tight text-white sm:text-5xl">
          {title}
        </h4>

        <p className="mt-3 text-sm uppercase tracking-[0.34em] text-white/55 sm:text-base">
          MBE NEW DROP
        </p>
      </div>
    </div>
  )
}

export function HomeHeroSwitcher({ nextDrop, recentDrop, heroSlides }: Props) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [showReleaseAnimation, setShowReleaseAnimation] = useState(false)
  const alreadyTriggeredRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setMounted(true)

    return () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current)

      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
    }
  }, [])

  const mode = useMemo(() => {
    if (!mounted) {
      if (nextDrop) return 'upcoming-drop'
      if (recentDrop) return 'live-drop'
      return 'carousel'
    }

    if (nextDrop) return 'upcoming-drop'
    if (recentDrop) return 'live-drop'
    return 'carousel'
  }, [mounted, nextDrop, recentDrop])

  const handleCountdownExpire = useCallback(async () => {
    if (alreadyTriggeredRef.current) return
    alreadyTriggeredRef.current = true

    setShowReleaseAnimation(true)

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([180, 120, 220, 120, 300, 150, 250])
    }

    audioRef.current = await playUnlockedDropSound()

    overlayTimeoutRef.current = setTimeout(() => {
      setShowReleaseAnimation(false)
    }, DROP_SOUND_DURATION_MS)

    refreshTimeoutRef.current = setTimeout(() => {
      router.refresh()
    }, DROP_REFRESH_DELAY_MS)
  }, [router])

  return (
    <div className="relative flex w-full flex-1">
      <DropReleaseOverlay
        visible={showReleaseAnimation}
        title={nextDrop?.dropName || nextDrop?.name || 'NUEVO DROP'}
      />

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