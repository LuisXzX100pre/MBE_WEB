'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react'

export type HomeHeroSlide = {
  id: string
  type: 'drop' | 'promo'
  eyebrow: string
  title: string
  subtitle: string
  image?: string | null
  priceText?: string
  ctaHref: string
  ctaLabel: string
  targetDate?: string
}

type TimeLeft = {
  expired: boolean
  days: string
  hours: string
  minutes: string
  seconds: string
}

function getTimeLeft(targetDate: Date): TimeLeft {
  const now = new Date()
  const difference = targetDate.getTime() - now.getTime()

  if (difference <= 0) {
    return {
      expired: true,
      days: '00',
      hours: '00',
      minutes: '00',
      seconds: '00',
    }
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24))
  const hours = Math.floor((difference / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((difference / (1000 * 60)) % 60)
  const seconds = Math.floor((difference / 1000) % 60)

  return {
    expired: false,
    days: String(days).padStart(2, '0'),
    hours: String(hours).padStart(2, '0'),
    minutes: String(minutes).padStart(2, '0'),
    seconds: String(seconds).padStart(2, '0'),
  }
}

function CompactCountdown({ targetDate }: { targetDate: string }) {
  const parsedTargetDate = useMemo(() => new Date(targetDate), [targetDate])
  const [mounted, setMounted] = useState(false)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    expired: false,
    days: '--',
    hours: '--',
    minutes: '--',
    seconds: '--',
  })

  useEffect(() => {
    setMounted(true)

    const updateCountdown = () => {
      setTimeLeft(getTimeLeft(parsedTargetDate))
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [parsedTargetDate])

  const items = [
    { label: 'Días', value: mounted ? timeLeft.days : '--' },
    { label: 'Horas', value: mounted ? timeLeft.hours : '--' },
    { label: 'Minutos', value: mounted ? timeLeft.minutes : '--' },
    { label: 'Segundos', value: mounted ? timeLeft.seconds : '--' },
  ]

  if (mounted && timeLeft.expired) {
    return (
      <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-center shadow-[0_18px_50px_rgba(0,0,0,0.24)]">
        <p className="text-base font-semibold text-white sm:text-lg">
          Este drop ya está disponible.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-md sm:p-4">
      <div className="mb-3 flex items-center gap-2 text-white/72">
        <Clock3 className="h-4 w-4" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">
          Cuenta regresiva
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[1rem] border border-white/10 bg-black/20 px-2 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:px-3 sm:py-5"
          >
            <div className="text-3xl font-black leading-none text-white tabular-nums sm:text-4xl">
              {item.value}
            </div>
            <div className="mt-2 text-[9px] uppercase tracking-[0.24em] text-white/45 sm:text-[10px]">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function HomeHeroCarousel({ slides }: { slides: HomeHeroSlide[] }) {
  const safeSlides = slides.length
    ? slides
    : [
        {
          id: 'fallback',
          type: 'promo' as const,
          eyebrow: 'MBE',
          title: 'Nueva colección',
          subtitle: 'Descubre las piezas más recientes de la tienda.',
          ctaHref: '/productos',
          ctaLabel: 'Explorar ahora',
          image: null,
        },
      ]

  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)

  const activeSlide = safeSlides[activeIndex]
  const hasMultiple = safeSlides.length > 1

  useEffect(() => {
    if (!hasMultiple || isPaused) return

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % safeSlides.length)
    }, 5500)

    return () => clearInterval(interval)
  }, [hasMultiple, isPaused, safeSlides.length])

  const goToPrev = () => {
    setActiveIndex((prev) => (prev - 1 + safeSlides.length) % safeSlides.length)
  }

  const goToNext = () => {
    setActiveIndex((prev) => (prev + 1) % safeSlides.length)
  }

  return (
    <div
      className="w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br from-[#080808] via-[#101010] to-[#050505] shadow-[0_25px_90px_rgba(0,0,0,0.42)] sm:rounded-[32px] lg:rounded-[38px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.07),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_24%),radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_42%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20" />
        <div className="absolute left-10 top-10 h-36 w-36 rounded-full bg-white/[0.04] blur-3xl" />
        <div className="absolute right-0 top-1/3 h-40 w-40 rounded-full bg-white/[0.03] blur-3xl" />

        <div className="relative grid min-h-[470px] items-center gap-8 px-4 py-6 sm:min-h-[530px] sm:px-6 md:min-h-[590px] md:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:px-10 xl:min-h-[600px] xl:px-12">
          <div className="order-2 flex flex-col justify-center lg:order-1">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.07] px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white shadow-[0_12px_34px_rgba(255,255,255,0.06)] sm:text-xs">
                {activeSlide.eyebrow}
              </span>

              {activeSlide.type === 'drop' && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75 sm:text-xs">
                  Próximo lanzamiento
                </span>
              )}

              {activeSlide.priceText && activeSlide.type !== 'drop' && (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/75 sm:text-xs">
                  {activeSlide.priceText}
                </span>
              )}
            </div>

            <h2 className="max-w-3xl text-3xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.4rem]">
              {activeSlide.title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/68 sm:text-base md:text-lg">
              {activeSlide.subtitle}
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href={activeSlide.ctaHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-all hover:translate-y-[-1px] hover:opacity-95 sm:px-6"
              >
                {activeSlide.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>

              {hasMultiple && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={goToPrev}
                    aria-label="Slide anterior"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition-all hover:bg-white/[0.09]"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    onClick={goToNext}
                    aria-label="Siguiente slide"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition-all hover:bg-white/[0.09]"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {activeSlide.type === 'drop' && activeSlide.targetDate && (
              <div className="mt-7 max-w-2xl">
                <CompactCountdown targetDate={activeSlide.targetDate} />
              </div>
            )}

            {hasMultiple && (
              <div className="mt-7 flex flex-wrap items-center gap-2">
                {safeSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Ir al slide ${index + 1}`}
                    className={`h-2.5 rounded-full transition-all ${
                      index === activeIndex
                        ? 'w-10 bg-white'
                        : 'w-2.5 bg-white/28 hover:bg-white/55'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="order-1 flex items-center justify-center lg:order-2">
            <div className="relative h-[270px] w-full overflow-hidden rounded-[22px] border border-white/10 bg-black/30 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:h-[340px] sm:rounded-[28px] md:h-[410px] lg:h-[470px]">
              <div className="absolute inset-0 z-10 bg-gradient-to-br from-white/[0.06] via-transparent to-transparent" />

              {activeSlide.image ? (
                <>
                  <Image
                    key={activeSlide.id}
                    src={activeSlide.image}
                    alt={activeSlide.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                    priority
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-center text-white/55">
                  Sin imagen principal
                </div>
              )}

              <div className="absolute bottom-4 left-4 right-4 z-20 rounded-[1.2rem] border border-white/10 bg-black/45 px-4 py-3 backdrop-blur-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">
                  {activeSlide.eyebrow}
                </p>
                <p className="mt-1 line-clamp-2 text-sm font-medium text-white/90 sm:text-base">
                  {activeSlide.title}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}