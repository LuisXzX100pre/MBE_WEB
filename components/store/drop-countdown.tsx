'use client'

import { useEffect, useMemo, useState } from 'react'

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
}

export function DropCountdown({
  targetDate,
  title = 'NUEVO DROP MBE',
  subtitle = 'Disponible muy pronto. Prepárate para el siguiente lanzamiento.',
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
    { label: 'Dias', value: mounted ? timeLeft.days : '--' },
    { label: 'Horas', value: mounted ? timeLeft.hours : '--' },
    { label: 'Minutos', value: mounted ? timeLeft.minutes : '--' },
    { label: 'Segundos', value: mounted ? timeLeft.seconds : '--' },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="rounded-[32px] border border-white/10 bg-white/[0.035] px-4 py-5 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-6 sm:py-6 md:px-8 md:py-8">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>

          <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-white/70 sm:text-xs">
            Proximo Drop
          </p>
        </div>

        <h2 className="mx-auto mb-3 max-w-3xl text-center text-3xl font-black leading-[0.95] tracking-tight text-white sm:text-4xl md:text-5xl">
          {title}
        </h2>

        <p className="mx-auto mb-5 max-w-2xl text-center text-sm text-white/60 sm:text-base">
          {subtitle}
        </p>

        {mounted && timeLeft.expired ? (
          <div className="rounded-3xl border border-white/10 bg-black/40 px-5 py-5">
            <p className="text-center text-lg font-semibold text-white md:text-xl">
              El drop ya está disponible.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {items.map((item) => (
              <div
                key={item.label}
                className="rounded-[24px] border border-white/10 bg-black/45 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:px-4 sm:py-5"
              >
                <div className="text-center text-4xl font-black leading-none text-white tabular-nums sm:text-5xl">
                  {item.value}
                </div>
                <div className="mt-2 text-center text-[10px] uppercase tracking-[0.28em] text-white/45 sm:text-xs">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}