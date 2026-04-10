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
    <div className="mb-8 flex justify-center">
      <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-white/[0.04] backdrop-blur-2xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] px-5 py-6 md:px-8 md:py-8">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-white/70 opacity-75 animate-ping" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
          </span>

          <p className="text-[11px] md:text-xs uppercase tracking-[0.38em] text-white/70 font-semibold">
            Proximo Drop
          </p>
        </div>

        <h2 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tight text-white mb-3">
          {title}
        </h2>

        <p className="text-sm md:text-base text-white/60 mb-6 max-w-2xl mx-auto">
          {subtitle}
        </p>

        {mounted && timeLeft.expired ? (
          <div className="rounded-2xl border border-white/10 bg-black/35 px-6 py-5">
            <p className="text-lg md:text-xl font-semibold text-white">
              El drop ya está disponible.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {items.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-white/10 bg-black/35 px-4 py-4 md:px-5 md:py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
              >
                <div className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-none tabular-nums">
                  {item.value}
                </div>
                <div className="mt-2 text-[10px] md:text-xs uppercase tracking-[0.25em] text-white/45">
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