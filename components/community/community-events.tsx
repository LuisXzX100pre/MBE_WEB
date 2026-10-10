'use client'
import { useEffect, useRef, useState } from 'react'
import { eventLabels } from '@/lib/community/event-config'
import type { MemberEvent, EventResults } from '@/lib/community/event-config'
export function EventResultBars({ results }: { results: EventResults }) {
  return <div className="mt-6 space-y-4" aria-label="Resultados de la participación">{results.options.map(option => <div key={option.key}><div className="mb-2 flex justify-between gap-3 text-xs"><span>{option.label}</span><span>{option.count} · {option.percent}%</span></div><div className="h-1.5 overflow-hidden bg-white/10"><div className="h-full bg-white/60" style={{ width: option.percent + '%' }} /></div></div>)}<p className="text-xs text-white/50">{results.total} {results.total === 1 ? 'voto' : 'votos'}</p></div>
}
export function CommunityEventCard({ event, now, onInteract }: { event: MemberEvent; now: number; onInteract: (id: string, payload: { response?: string; optionKey?: string }) => Promise<void> }) {
  const [response, setResponse] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const pending = useRef(false)
  const scheduled = new Date(event.startsAt).getTime() > now
  const blocked = busy || scheduled || new Date(event.endsAt).getTime() <= now || !!event.myInteraction
  async function participate(payload: { response?: string; optionKey?: string }) {
    if (blocked || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await onInteract(event.id, payload) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo registrar la participacion') }
    finally { pending.current = false; setBusy(false) }
  }
  const chosen = event.options.find(option => option.key === event.myInteraction?.optionKey)?.label
  return <div>
    <p className="mb-3 text-[10px] uppercase tracking-widest text-white/50">{eventLabels[event.type]} / {scheduled ? 'Próximamente' : 'En curso'}</p>
    <h3 className="text-2xl font-bold uppercase">{event.title}</h3><p className="mt-4 max-w-xl whitespace-pre-wrap text-sm leading-7 text-white/50">{event.description}</p>
    <p className="mt-3 text-xs text-white/40">{new Date(event.startsAt).toLocaleString('es-MX')} — {new Date(event.endsAt).toLocaleString('es-MX')}</p>
    {event.type !== 'ANNOUNCEMENT' && <div className="mt-6 max-w-2xl">
      {event.type === 'DECISION' && <p className="mb-5 text-sm text-white/60">Tu voz también construye lo que sigue.</p>}
      {event.type === 'CHOICE' && <p className="mb-5 text-sm text-white/60">Una elección. Sin vuelta atrás.</p>}
      {event.myInteraction ? <div role="status" className="border-l-2 border-white/40 px-4 py-3"><p className="text-xs font-bold uppercase">{event.type === 'MISSION' ? 'Participación registrada' : event.type === 'CHOICE' ? 'Elegiste ' + chosen : 'Tu elección fue registrada.'}</p>{event.type === 'MISSION' ? <p className="mt-3 whitespace-pre-wrap break-words text-sm text-white/60">{event.myInteraction.response}</p> : event.type === 'DECISION' && <p className="mt-3 text-sm text-white/60">{chosen}</p>}</div>
        : event.type === 'MISSION' ? <form onSubmit={e => { e.preventDefault(); void participate({ response }) }} className="space-y-4"><label className="block text-sm text-white/60">{event.interactionPrompt}<textarea required maxLength={500} disabled={blocked} value={response} onChange={e => setResponse(e.target.value)} rows={3} className="mt-3 block w-full border border-white/25 bg-transparent p-4 text-white disabled:opacity-40" /></label><button disabled={blocked || !response.trim()} className="border border-white/30 px-6 py-3 text-xs font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Registrando...' : 'Enviar participación'}</button></form>
        : <div className={event.type === 'CHOICE' ? 'grid gap-4 sm:grid-cols-2' : 'grid gap-3'}>{event.options.map(option => <button key={option.key} type="button" disabled={blocked} onClick={() => participate({ optionKey: option.key })} className={'border border-white/25 p-5 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40 ' + (event.type === 'CHOICE' ? 'flex min-h-44 flex-col items-center justify-center gap-8 text-center' : 'flex items-center justify-between gap-5')}><span className="text-lg font-bold uppercase">{option.label}</span><span className="text-[10px] uppercase tracking-widest">{busy ? 'Registrando...' : event.type === 'CHOICE' ? 'Elegir' : 'Votar'}</span></button>)}</div>}
      {scheduled && <p className="mt-4 text-xs text-white/60">Disponible el {new Date(event.startsAt).toLocaleString('es-MX')}</p>}
      {event.myInteraction && event.results && <EventResultBars results={event.results} />}
      {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
    </div>}
  </div>
}
type Ticket = { id: string; discountPercent: number; code: string; createdAt: string; expiresAt: string | null; usedAt: string | null; event: { title: string } }
export function CommunityEvents() {
  const [events, setEvents] = useState<MemberEvent[]>([]), [tickets, setTickets] = useState<Ticket[]>([]), [error, setError] = useState(''), [loaded, setLoaded] = useState(false), [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const controller = new AbortController()
    const clock = setInterval(() => setNow(Date.now()), 1000)
    fetch('/api/community/events', { cache: 'no-store', signal: controller.signal })
      .then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); setEvents(data.events); setTickets(data.tickets); setLoaded(true) })
      .catch(e => { if (e.name !== 'AbortError') setError(e.message) })
    return () => { controller.abort(); clearInterval(clock) }
  }, [])
  async function interact(id: string, payload: { response?: string; optionKey?: string }) {
    const res = await fetch('/api/community/events/' + encodeURIComponent(id) + '/interact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'No se pudo registrar la participacion')
    setEvents(data.events); setTickets(data.tickets)
  }
  return <section id="eventos" className="scroll-mt-24">
    <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-white/40">03 / EVENTOS</p><h2 className="mb-10 text-4xl font-black uppercase tracking-tighter sm:text-5xl">Lo inesperado<br /><span className="text-white/35">también es MBE.</span></h2>
    {!loaded && !error && <p className="text-sm text-white/40">Abriendo agenda...</p>}
    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    {loaded && !events.length && <p className="border-t border-white/10 py-8 text-sm text-white/50">Las sorpresas no se anuncian afuera. Vuelve para descubrir el proximo evento.</p>}
    {events.filter(event => new Date(event.endsAt).getTime() > now).map((event, i) => <article key={event.id} className="grid gap-6 border-t border-white/15 py-8 sm:grid-cols-[80px_1fr]">
      <span className="text-4xl font-black text-white/20">{String(i + 1).padStart(2, '0')}</span>
      <CommunityEventCard event={event} now={now} onInteract={interact} />
    </article>)}
    {tickets.length > 0 && <div className="mt-12"><h3 className="mb-6 text-xl font-black uppercase">Tus tickets</h3><div className="grid gap-5 sm:grid-cols-2">{tickets.map(t => <div key={t.id} className="relative overflow-hidden border border-dashed border-white/30 p-6">
      <p className="text-[10px] uppercase tracking-widest text-white/40">{t.event.title}</p><p className="my-4 text-4xl font-black">{t.discountPercent}% OFF</p><code className="break-all text-sm">{t.code}</code>
      <p className="mt-5 text-xs text-white/40">{t.usedAt ? 'Utilizado' : t.expiresAt && new Date(t.expiresAt) <= new Date() ? 'Expirado' : 'Guardado en tu cuenta'}{t.expiresAt && ' / vence ' + new Date(t.expiresAt).toLocaleString('es-MX')}</p>
      <p className="mt-2 text-[10px] text-white/35">{t.usedAt ? 'Utilizado' : t.expiresAt && new Date(t.expiresAt) <= new Date() ? 'Expirado' : 'Se aplicará automáticamente en tu próxima compra mientras siga vigente.'}</p>
    </div>)}</div></div>}
  </section>
}
