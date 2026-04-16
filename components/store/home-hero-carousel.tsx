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
    { label: 'Dias', value: mounted ? timeLeft.days : '--' },
    { label: 'Horas', value: mounted ? timeLeft.hours : '--' },
    { label: 'Minutos', value: mounted ? timeLeft.minutes : '--' },
    { label: 'Segundos', value: mounted ? timeLeft.seconds : '--' },
  ]

  if (mounted && timeLeft.expired) {
    return (
      <div className="rounded-[22px] border border-white/10 bg-black/55 p-5 text-center shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:rounded-[28px] sm:p-6">
        <p className="text-base font-semibold text-white sm:text-lg">
          El drop ya está disponible.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[22px] border border-white/10 bg-black/50 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:rounded-[28px] sm:p-6">
      <div className="mb-4 flex items-center justify-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>

        <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-white/70 sm:text-xs">
          Próximo drop
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-[18px] border border-white/10 bg-black/50 px-3 py-4 text-center sm:rounded-[22px] sm:px-4 sm:py-5"
          >
            <div className="text-3xl font-black leading-none text-white tabular-nums sm:text-5xl">
              {item.value}
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-xs sm:tracking-[0.26em]">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const themeClasses = [
  'from-[#0f0f10] via-[#171717] to-[#0a0a0a]',
  'from-[#121826] via-[#111111] to-[#0a0a0a]',
  'from-[#1a1200] via-[#151515] to-[#090909]',
  'from-[#140f1e] via-[#151515] to-[#090909]',
]

export function HomeHeroCarousel({ slides }: { slides: HomeHeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return

    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length)
    }, 30000)

    return () => clearInterval(interval)
  }, [slides.length])

  if (slides.length === 0) return null

  const activeSlide = slides[activeIndex]
  const currentTheme = themeClasses[activeIndex % themeClasses.length]

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % slides.length)
  }

  return (
    <div className="w-full">
      <div
        className={`relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br ${currentTheme} shadow-[0_25px_90px_rgba(0,0,0,0.35)] sm:rounded-[32px] lg:rounded-[38px]`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.09),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_24%)]" />

        <div className="relative grid min-h-[420px] w-full items-center gap-8 px-4 py-5 sm:min-h-[500px] sm:px-6 sm:py-6 md:min-h-[560px] md:px-8 md:py-8 lg:min-h-[520px] lg:grid-cols-[1.02fr_0.98fr] lg:px-10 xl:min-h-[560px] xl:px-12">
          <div className="flex flex-col justify-center">
            <p className="mb-4 inline-flex w-fit rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-white/70 sm:px-4 sm:text-xs sm:tracking-[0.28em]">
              {activeSlide.eyebrow}
            </p>

            <h2 className="max-w-3xl text-3xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl md:text-5xl lg:text-[3.4rem]">
              {activeSlide.title}
            </h2>

            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/65 sm:text-base md:text-lg">
              {activeSlide.subtitle}
            </p>

            {activeSlide.priceText && (
              <p className="mt-5 text-2xl font-black text-white sm:text-3xl md:text-4xl">
                {activeSlide.priceText}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={activeSlide.ctaHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 sm:px-6"
              >
                {activeSlide.ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/productos"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 sm:px-6"
              >
                Ver todos los productos
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-center">
            {activeSlide.type === 'drop' && activeSlide.targetDate ? (
              <div className="w-full max-w-2xl">
                <CompactCountdown targetDate={activeSlide.targetDate} />
              </div>
            ) : activeSlide.image ? (
              <div className="relative h-[240px] w-full overflow-hidden rounded-[22px] border border-white/10 bg-black/30 shadow-[0_20px_80px_rgba(0,0,0,0.35)] sm:h-[320px] sm:rounded-[28px] md:h-[360px] lg:h-[390px] xl:h-[430px]">
                <Image
                  src={activeSlide.image}
                  alt={activeSlide.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              </div>
            ) : (
              <div className="grid w-full grid-cols-2 gap-3 sm:gap-4">
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm sm:tracking-[0.28em]">
                    MBE
                  </p>
                  <p className="mt-3 text-xl font-black text-white sm:text-2xl">
                    Streetwear
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm sm:tracking-[0.28em]">
                    Calidad
                  </p>
                  <p className="mt-3 text-xl font-black text-white sm:text-2xl">
                    Premium
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm sm:tracking-[0.28em]">
                    Drops
                  </p>
                  <p className="mt-3 text-xl font-black text-white sm:text-2xl">
                    Exclusivos
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-black/35 p-4 sm:rounded-[26px] sm:p-6">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-white/45 sm:text-sm sm:tracking-[0.28em]">
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

        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Slide anterior"
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-2.5 text-white/80 backdrop-blur-md transition-colors hover:bg-black/65 sm:left-4 sm:p-3"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              onClick={goNext}
              aria-label="Slide siguiente"
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-2.5 text-white/80 backdrop-blur-md transition-colors hover:bg-black/65 sm:right-4 sm:p-3"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 sm:bottom-5">
              {slides.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Ir al slide ${index + 1}`}
                  className={`h-2.5 rounded-full transition-all ${
                    index === activeIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/35'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground sm:text-xs">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span>El banner cambia automaticamente cada 30 segundos</span>
        </div>
      )}
    </div>
  )
}