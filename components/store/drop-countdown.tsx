'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'

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

interface DropCountdownProps {
  targetDate: string
  title?: string
  ctaHref?: string
  ctaLabel?: string
}

export function DropCountdown({
  targetDate,
  title = 'NUEVO DROP MBE',
  ctaHref,
  ctaLabel = 'Ver drop',
}: DropCountdownProps) {
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
    { label: 'DIAS', value: mounted ? timeLeft.days : '--' },
    { label: 'HORAS', value: mounted ? timeLeft.hours : '--' },
    { label: 'MINUTOS', value: mounted ? timeLeft.minutes : '--' },
    { label: 'SEGUNDOS', value: mounted ? timeLeft.seconds : '--' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-center">
      <div className="mb-6 flex items-center justify-center gap-3 sm:mb-8">
        <span className="relative flex h-3.5 w-3.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-white" />
        </span>

        <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-white/70 sm:text-xs md:text-sm">
          PROXIMO DROP
        </p>
      </div>

      <h2 className="mx-auto mb-8 max-w-5xl text-center text-4xl font-black leading-[0.92] tracking-tight text-white sm:mb-10 sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem]">
        {title}
      </h2>

      {mounted && timeLeft.expired ? (
        <div className="text-center">
          <p className="text-2xl font-semibold text-white sm:text-3xl">
            El drop ya esta disponible.
          </p>
        </div>
      ) : (
        <>
          <div className="grid w-full max-w-[1200px] grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {items.map((item) => (
              <div
                key={item.label}
                className="rounded-[28px] border border-white/10 bg-transparent px-4 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[2px] sm:px-5 sm:py-8 lg:px-6 lg:py-10"
              >
                <div className="text-5xl font-black leading-none text-white tabular-nums sm:text-6xl md:text-7xl lg:text-[5.5rem]">
                  {item.value}
                </div>
                <div className="mt-4 text-[11px] uppercase tracking-[0.38em] text-white/45 sm:text-xs md:text-sm">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {ctaHref && (
            <div className="mt-8 sm:mt-10">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:scale-[1.02] hover:opacity-90 sm:px-7 sm:py-3.5 sm:text-base"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}