'use client'
import { useEffect, useState } from 'react'
type Event = { id: string; title: string; description: string; startsAt: string; endsAt: string }
type Ticket = { id: string; discountPercent: number; code: string; createdAt: string; expiresAt: string | null; usedAt: string | null; event: { title: string } }
export function CommunityEvents() {
  const [events, setEvents] = useState<Event[]>([]), [tickets, setTickets] = useState<Ticket[]>([]), [error, setError] = useState(''), [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/community/events', { cache: 'no-store', signal: controller.signal })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setEvents(data.events); setTickets(data.tickets); setLoaded(true) })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => controller.abort()
  }, [])
  return <section id="eventos" className="scroll-mt-24">
    <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-white/40">03 / Mantente dentro</p><h2 className="mb-10 text-4xl font-black uppercase tracking-tighter sm:text-5xl">Lo inesperado<br /><span className="text-white/35">tambien es MBE.</span></h2>
    {!loaded && !error && <p className="text-sm text-white/40">Abriendo agenda...</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {loaded && !events.length && <p className="border-t border-white/10 py-8 text-sm text-white/50">Las sorpresas no se anuncian afuera. Vuelve para descubrir el proximo evento.</p>}
    {events.map((event, i) => <article key={event.id} className="grid gap-6 border-t border-white/15 py-8 sm:grid-cols-[80px_1fr]">
      <span className="text-4xl font-black text-white/20">{String(i + 1).padStart(2, '0')}</span>
      <div><p className="mb-3 text-[10px] uppercase tracking-widest text-white/40">{new Date(event.startsAt) > new Date() ? 'Proximamente' : 'En curso'} / {new Date(event.startsAt).toLocaleString('es-MX')} ? {new Date(event.endsAt).toLocaleString('es-MX')}</p><h3 className="text-2xl font-bold uppercase">{event.title}</h3><p className="mt-4 max-w-xl whitespace-pre-wrap text-sm leading-7 text-white/50">{event.description}</p></div>
    </article>)}
    {tickets.length > 0 && <div className="mt-12"><h3 className="mb-6 text-xl font-black uppercase">Tus tickets</h3><div className="grid gap-5 sm:grid-cols-2">{tickets.map(t => <div key={t.id} className="relative overflow-hidden border border-dashed border-white/30 p-6">
      <p className="text-[10px] uppercase tracking-widest text-white/40">{t.event.title}</p><p className="my-4 text-4xl font-black">{t.discountPercent}% OFF</p><code className="break-all text-sm">{t.code}</code>
      <p className="mt-5 text-xs text-white/40">{t.usedAt ? 'Utilizado' : t.expiresAt && new Date(t.expiresAt) <= new Date() ? 'Expirado' : 'Guardado en tu cuenta'}{t.expiresAt && ' / vence ' + new Date(t.expiresAt).toLocaleString('es-MX')}</p>
      <p className="mt-2 text-[10px] text-white/35">{t.usedAt ? 'Utilizado' : t.expiresAt && new Date(t.expiresAt) <= new Date() ? 'Expirado' : 'Se aplicará automáticamente en tu próxima compra mientras siga vigente.'}</p>
    </div>)}</div></div>}
  </section>
}
