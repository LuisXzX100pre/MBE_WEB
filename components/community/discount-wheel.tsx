'use client'
import { useEffect, useRef, useState } from 'react'
type State = { campaign: { id: string; name: string } | null; spin: { discountPercent: number; usedAt: string | null } | null }
const prizes = [2, 4, 5, 10]
export function DiscountWheel() {
  const [state, setState] = useState<State | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [angle, setAngle] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/community/wheel', { signal: controller.signal, cache: 'no-store' })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setState(data) })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => { controller.abort(); if (timer.current) clearTimeout(timer.current) }
  }, [])
  async function spin() {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const res = await fetch('/api/community/wheel', { method: 'POST' }), data: State & { error?: string } = await res.json()
      if (!res.ok) throw new Error(data.error)
      const index = prizes.indexOf(data.spin!.discountPercent)
      if (index < 0) throw new Error('Resultado invalido')
      setAngle(5 * 360 + (360 - index * 90 - 45))
      timer.current = setTimeout(() => { setState(data); setBusy(false); pending.current = false }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 4200)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo girar'); setBusy(false); pending.current = false }
  }
  return <section id="ruleta" className="my-20 scroll-mt-24 border-y border-white/15 py-14">
    <div className="grid items-center gap-14 md:grid-cols-2">
      <div><p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-white/40">02 / Tu ventaja</p><h2 className="text-4xl font-black uppercase leading-none tracking-tighter sm:text-5xl">Un giro.<br />Tu siguiente<br /><span className="text-white/35">movimiento.</span></h2>
        <p className="my-6 max-w-sm text-sm leading-7 text-white/50">Un giro por persona en cada campana. Tu resultado se queda contigo.</p>
        <p className="text-xs text-white/40">{state?.campaign?.name || 'Espera la siguiente campana.'}</p>
        <div aria-live="polite" className="mt-8">{state?.spin && !busy
          ? <div><p className="text-[10px] uppercase tracking-[0.3em] text-white/50">Tu descuento / ganaste</p><p className="mt-2 text-6xl font-black tracking-tighter">{state.spin.discountPercent}% OFF</p><p className="mt-3 text-xs text-white/40">{state.spin.usedAt ? 'Marcado como utilizado' : 'Guardado en tu cuenta. Aun no canjeable en checkout.'}</p></div>
          : <button disabled={busy || !state?.campaign} onClick={spin} className="border border-white/30 bg-white px-8 py-4 text-xs font-bold uppercase tracking-widest text-black disabled:opacity-30">{busy ? 'Tu suerte esta en movimiento...' : 'Girar la ruleta'}</button>}
        </div>{error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
      <div className="relative mx-auto w-full max-w-[360px] p-4">
        <span aria-hidden className="absolute left-1/2 top-1 z-10 -translate-x-1/2 text-2xl text-white">&#9660;</span>
        <div aria-hidden className="relative aspect-square rounded-full border border-white/30 bg-[conic-gradient(#d6d6d6_0deg_90deg,#222_90deg_180deg,#929292_180deg_270deg,#111_270deg_360deg)] transition-transform duration-[4200ms] motion-reduce:transition-none" style={{ transform: 'rotate(' + angle + 'deg)', transitionTimingFunction: 'cubic-bezier(.12,.7,.12,1)' }}>
          {prizes.map((p, i) => <span key={p} className={'absolute left-1/2 top-1/2 text-2xl font-black ' + (i % 2 ? 'text-white' : 'text-black')} style={{ transform: 'translate(-50%, -50%) rotate(' + (i * 90 + 45) + 'deg) translateY(-105px) rotate(-' + (i * 90 + 45) + 'deg)' }}>{p}%</span>)}
          <span className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#080808] text-lg font-black text-white">MBE</span>
        </div>
      </div>
    </div>
  </section>
}
