'use client'
import { useEffect, useRef, useState } from 'react'
import type { WheelState } from '@/lib/community/wheel-config'
const prizes = [2, 4, 5, 10]
export function DiscountWheel({ initialState }: { initialState: WheelState }) {
  const [state, setState] = useState(initialState), [busy, setBusy] = useState(false), [error, setError] = useState(''), [angle, setAngle] = useState(0), [now, setNow] = useState(() => Date.now())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null), pending = useRef(false)
  const campaign = state.campaign
  const available = !!campaign && (!campaign.startsAt || new Date(campaign.startsAt).getTime() <= now) && (!campaign.endsAt || new Date(campaign.endsAt).getTime() > now)
  useEffect(() => {
    const controller = new AbortController()
    const clock = setInterval(() => setNow(Date.now()), 1000)
    fetch('/api/community/wheel', { signal: controller.signal, cache: 'no-store' })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); if (!pending.current) setState(data) })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => { controller.abort(); clearInterval(clock); if (timer.current) clearTimeout(timer.current) }
  }, [])
  async function spin() {
    if (pending.current || state.spin || !available) return
    pending.current = true; setBusy(true); setError('')
    try {
      const res = await fetch('/api/community/wheel', { method: 'POST' }), data: WheelState & { error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error || 'La campaña ya no está disponible.')
      const index = prizes.indexOf(data.spin?.discountPercent ?? -1)
      if (!data.campaign || !data.spin || index < 0) throw new Error('No se pudo consultar tu resultado. Recarga para verificarlo.')
      setAngle(previous => Math.ceil(previous / 360) * 360 + 5 * 360 + (360 - index * 90 - 45))
      timer.current = setTimeout(() => { setState(data); setBusy(false); pending.current = false }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 4200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo girar'); setBusy(false); pending.current = false
      // Refresh availability/result after a race with campaign activation or expiry.
      try { const res = await fetch('/api/community/wheel', { cache: 'no-store' }); if (res.ok) setState(await res.json()) } catch { /* Keep the visible error so the member can retry. */ }
    }
  }
  return <section id="ruleta" className="mb-12 scroll-mt-24 border-y border-white/15 py-8 sm:mb-16 sm:py-12">
    <div className="grid items-center gap-8 md:grid-cols-[1.1fr_1fr] md:gap-12">
      <div className="min-w-0">
        <p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-white/40">01 / {available ? 'Campaña activa' : 'Entre movimientos'}</p>
        <h2 className="break-words text-3xl font-black uppercase leading-none tracking-tighter sm:text-5xl">{campaign?.title || campaign?.name || 'El próximo movimiento está por llegar.'}</h2>
        {campaign && <><p className="mt-5 break-words text-base font-medium sm:text-xl">{campaign.subtitle || 'Un giro. Tu siguiente movimiento.'}</p><p className="mt-3 max-w-lg whitespace-pre-wrap break-words text-sm leading-6 text-white/55">{campaign.description || 'Un beneficio para quienes están dentro. Tu resultado se conserva en tu cuenta.'}</p>{campaign.note && <p className="mt-4 break-words text-xs text-white/50">{campaign.note}</p>}{campaign.endsAt && <p className="mt-4 text-[10px] text-white/40">Hasta {new Date(campaign.endsAt).toLocaleString('es-MX')}</p>}</>}
        {!available && <p className="mt-4 max-w-md text-sm leading-6 text-white/50">No hay una campaña abierta para girar. Tu acceso y tus resultados anteriores se conservan.</p>}
        {available && <p className="mt-5 text-xs text-white/45">Un giro por miembro en esta campaña. El resultado queda guardado.</p>}
        <div aria-live="polite" className="mt-6">{state.spin && !busy
          ? <div className="border-l-2 border-white/60 bg-white/[0.035] px-5 py-4"><p className="text-[10px] uppercase tracking-[0.2em] text-white/50">{campaign ? 'Ya participaste / tu resultado' : 'Tu último resultado guardado'}</p><p className="mt-2 text-5xl font-black tracking-tighter sm:text-6xl">{state.spin.discountPercent}% OFF</p><p className="mt-3 text-xs text-white/50">{state.spin.usedAt ? 'Beneficio marcado como utilizado.' : 'Beneficio guardado · sin utilizar.'}</p><p className="mt-2 text-[10px] text-white/35">Todavía no se aplica en checkout.</p></div>
          : available && <button disabled={busy} onClick={spin} className="w-full bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-black disabled:opacity-40 sm:w-auto">{busy ? 'Revelando tu resultado...' : 'Desbloquear mi giro'}</button>}
        </div>{error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      </div>
      {campaign && <div className="relative mx-auto w-full max-w-[300px] p-4 sm:max-w-[360px]">
        <span aria-hidden="true" className="absolute left-1/2 top-1 z-10 -translate-x-1/2 text-2xl text-white">&#9660;</span>
        <div aria-hidden="true" className="relative aspect-square rounded-full border border-white/30 bg-[conic-gradient(#d6d6d6_0deg_90deg,#222_90deg_180deg,#929292_180deg_270deg,#111_270deg_360deg)] transition-transform duration-[4200ms] motion-reduce:transition-none" style={{ transform: 'rotate(' + angle + 'deg)', transitionTimingFunction: 'cubic-bezier(.12,.7,.12,1)' }}>
          {prizes.map((p, i) => <span key={p} className={'absolute left-1/2 top-1/2 text-xl font-black sm:text-2xl ' + (i % 2 ? 'text-white' : 'text-black')} style={{ transform: 'translate(-50%, -50%) rotate(' + (i * 90 + 45) + 'deg) translateY(-85px) rotate(-' + (i * 90 + 45) + 'deg)' }}>{p}%</span>)}
          <span className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#080808] text-lg font-black text-white">MBE</span>
        </div><p className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-white/35">{state.spin ? 'Resultado guardado' : 'Tu beneficio se revela al girar'}</p>
      </div>}
    </div>
  </section>
}
