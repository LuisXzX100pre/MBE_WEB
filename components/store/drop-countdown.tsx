'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  subtitle?: string
  ctaHref?: string
  ctaLabel?: string
  onExpire?: () => void
}

export function DropCountdown({
  targetDate,
  title = 'NUEVO DROP MBE',
  subtitle = 'Prepárate para el siguiente lanzamiento. El acceso se habilita automáticamente cuando termine el contador.',
  ctaHref,
  ctaLabel = 'Ver drop',
  onExpire,
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
  const expireTriggeredRef = useRef(false)

  useEffect(() => {
    setMounted(true)

    const updateCountdown = () => {
      const nextValue = getTimeLeft(parsedTargetDate)
      setTimeLeft(nextValue)

      if (nextValue.expired && !expireTriggeredRef.current) {
        expireTriggeredRef.current = true
        onExpire?.()
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)

    return () => clearInterval(interval)
  }, [parsedTargetDate, onExpire])

  const items = [
    { label: 'DÍAS', value: mounted ? timeLeft.days : '--' },
    { label: 'HORAS', value: mounted ? timeLeft.hours : '--' },
    { label: 'MINUTOS', value: mounted ? timeLeft.minutes : '--' },
    { label: 'SEGUNDOS', value: mounted ? timeLeft.seconds : '--' },
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center justify-center">
      <div className="relative w-full overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#070707] via-[#101010] to-[#050505] px-4 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.42)] sm:px-6 sm:py-10 lg:rounded-[2.5rem] lg:px-8 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.05),transparent_26%),radial-gradient(circle_at_center,rgba(255,255,255,0.03),transparent_45%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px] opacity-15" />
        <div className="absolute -left-16 top-1/2 h-52 w-52 -translate-y-1/2 rounded-full bg-red-600/10 blur-3xl" />
        <div className="absolute -right-16 top-0 h-52 w-52 rounded-full bg-white/[0.04] blur-3xl" />

        <div className="relative z-10">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-3 sm:mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-red-500/25 bg-red-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white shadow-[0_12px_34px_rgba(220,38,38,0.35)] sm:text-xs">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
              </span>
              Próximo Drop
            </span>
          </div>

          <h2 className="mx-auto max-w-5xl text-center text-4xl font-black leading-[0.92] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem]">
            {title}
          </h2>

          {subtitle && (
            <p className="mx-auto mt-5 max-w-3xl text-center text-sm leading-relaxed text-white/62 sm:mt-6 sm:text-base md:text-lg">
              {subtitle}
            </p>
          )}

          <div className="mt-8 grid w-full grid-cols-2 gap-4 sm:mt-10 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {items.map((item) => (
              <div
                key={item.label}
                className="group relative overflow-hidden rounded-[1.7rem] border border-white/10 bg-white/[0.035] px-4 py-6 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md transition-transform duration-300 hover:-translate-y-1 sm:px-5 sm:py-8 lg:px-6 lg:py-10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-red-500/[0.03] opacity-90" />
                <div className="relative z-10">
                  <div className="text-5xl font-black leading-none text-white tabular-nums sm:text-6xl md:text-7xl lg:text-[5.2rem]">
                    {item.value}
                  </div>
                  <div className="mt-4 text-[11px] uppercase tracking-[0.34em] text-white/45 sm:text-xs md:text-sm">
                    {item.label}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {ctaHref && (
            <div className="mt-8 flex justify-center sm:mt-10">
              <Link
                href={ctaHref}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-all hover:translate-y-[-1px] hover:opacity-95 sm:px-7 sm:py-3.5 sm:text-base"
              >
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}