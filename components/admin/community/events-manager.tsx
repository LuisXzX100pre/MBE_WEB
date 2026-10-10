'use client'
import { useCallback, useEffect, useState } from 'react'
import { communityRequest, field, action } from './request'
import { TicketsManager } from './tickets-manager'
import { eventLabels } from '@/lib/community/event-config'
import type { EventType, EventOption, EventParticipation } from '@/lib/community/event-config'
import { EventResultBars } from '@/components/community/community-events'
type Event = { id: string; type: EventType; title: string; description: string; interactionPrompt: string | null; options: EventOption[] | null; active: boolean; startsAt: string; endsAt: string; _count: { tickets: number; interactions: number } }
const empty = { title: '', description: '', active: false, startsAt: '', endsAt: '', type: 'ANNOUNCEMENT' as EventType, interactionPrompt: '', options: [{ key: 'a', label: '' }, { key: 'b', label: '' }] }
const localDate = (value: string) => new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
export function EventsManager() {
  const [events, setEvents] = useState<Event[]>([]), [form, setForm] = useState(empty), [id, setId] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [participation, setParticipation] = useState<EventParticipation | null>(null)
  const locked = !!id && (events.find(event => event.id === id)?._count.interactions ?? 0) > 0
  const refresh = useCallback(async () => setEvents(await communityRequest<Event[]>('/api/admin/community/events')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [refresh])
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await communityRequest('/api/admin/community/events' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() }); await refresh(); setId(null); setForm(empty) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  async function viewParticipation(eventId: string) {
    setBusy(true); setError(''); setParticipation(null)
    try { setParticipation(await communityRequest<EventParticipation>('/api/admin/community/events/' + eventId + '/participation')) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar la participacion') }
    finally { setBusy(false) }
  }
  return <section><h2 className="mb-6 text-2xl font-black uppercase">Eventos</h2>
    <form onSubmit={save} className="mb-10 grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-white/50">Tipo de evento<select disabled={busy || locked} className={field + ' mt-2'} value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value as EventType, options: e.target.value === 'CHOICE' ? prev.options.slice(0, 2) : prev.options }))}><option value="ANNOUNCEMENT">Anuncio</option><option value="MISSION">Misión MBE</option><option value="DECISION">Decisión MBE</option><option value="CHOICE">The Choice</option></select></label>
      <label className="text-xs text-white/50">Titulo<input required maxLength={160} className={field + ' mt-2'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label className="text-xs text-white/50">Descripcion<textarea required maxLength={3000} className={field + ' mt-2'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      {form.type === 'MISSION' && <label className="text-xs text-white/50 sm:col-span-2">Prompt / instrucción de participación<textarea required maxLength={500} disabled={busy || locked} className={field + ' mt-2'} value={form.interactionPrompt} onChange={e => setForm({ ...form, interactionPrompt: e.target.value })} /></label>}
      {(form.type === 'DECISION' || form.type === 'CHOICE') && <fieldset className="space-y-3 sm:col-span-2"><legend className="mb-3 text-xs text-white/50">{form.type === 'CHOICE' ? 'Exactamente 2 opciones' : 'De 2 a 6 opciones'}</legend>{form.options.map((option, index) => <div key={option.key} className="flex items-center gap-3"><label className="flex-1 text-xs text-white/50">Opción {index + 1}<input required maxLength={100} disabled={busy || locked} className={field + ' mt-2'} value={option.label} onChange={e => setForm(prev => ({ ...prev, options: prev.options.map(o => o.key === option.key ? { ...o, label: e.target.value } : o) }))} /></label>{form.type === 'DECISION' && <button type="button" disabled={busy || locked || form.options.length <= 2} onClick={() => setForm(prev => ({ ...prev, options: prev.options.filter(o => o.key !== option.key) }))} className="text-xs disabled:opacity-40">Quitar</button>}</div>)}{form.type === 'DECISION' && <button type="button" disabled={busy || locked || form.options.length >= 6} onClick={() => setForm(prev => ({ ...prev, options: [...prev.options, { key: 'o_' + crypto.randomUUID(), label: '' }] }))} className={action}>Agregar opción</button>}</fieldset>}
      {locked && <p className="text-xs text-white/50 sm:col-span-2">Este evento ya tiene participaciones. Su tipo, instrucciones de misión y opciones quedan protegidos.</p>}
      <label className="text-xs text-white/50">Inicio / hora local<input required type="datetime-local" className={field + ' mt-2'} value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></label>
      <label className="text-xs text-white/50">Fin / hora local<input required type="datetime-local" className={field + ' mt-2'} value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Activo</label>
      <div className="flex flex-wrap gap-3"><button disabled={busy} className={action}>{id ? 'Guardar cambios' : 'Crear evento'}</button>{id && <button type="button" className={action} onClick={() => { setId(null); setForm(empty) }}>Cancelar</button>}</div>
    </form>{error && <p role="alert" className="text-red-400">{error}</p>}
    {events.map(e => <div key={e.id} className="flex flex-wrap justify-between gap-4 border-t border-white/10 py-5"><div><p className="font-bold">{e.title}</p><p className="mt-2 text-xs text-white/40">{eventLabels[e.type || 'ANNOUNCEMENT']} / {e.active ? 'Activo' : 'Inactivo'} / {e._count.tickets} tickets / {e._count.interactions ?? 0} participantes / {new Date(e.startsAt).toLocaleString('es-MX')}</p></div><div className="flex gap-5"><button disabled={busy} className="text-xs" onClick={() => { setId(e.id); setForm({ title: e.title, description: e.description, active: e.active, startsAt: localDate(e.startsAt), endsAt: localDate(e.endsAt), type: e.type || 'ANNOUNCEMENT', interactionPrompt: e.interactionPrompt || '', options: e.options?.length ? e.options : empty.options }) }}>Editar / activar</button><button disabled={busy} className="text-xs" onClick={() => viewParticipation(e.id)}>Ver participación</button></div></div>)}
    {participation && <div className="my-8 border border-white/20 p-5"><div className="flex justify-between gap-4"><h3 className="font-bold">{participation.event.title} / {participation.total} participantes</h3><button type="button" className="text-xs" onClick={() => setParticipation(null)}>Cerrar resultados</button></div>{participation.results && <EventResultBars results={participation.results} />}<details className="mt-5" open={participation.event.type === 'MISSION'}><summary className="cursor-pointer text-xs">Participaciones por orden de llegada</summary><div className="mt-4 space-y-4">{participation.participants.map(p => <div key={p.id} className="border-t border-white/10 pt-3"><p className="text-sm font-bold">{p.user.username}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/60">{p.response ?? participation.results?.options.find(o => o.key === p.optionKey)?.label}</p><time className="mt-2 block text-xs text-white/40" dateTime={p.createdAt}>{new Date(p.createdAt).toLocaleString('es-MX')}</time></div>)}{!participation.total && <p className="text-xs text-white/50">Todavía no hay participaciones.</p>}</div></details></div>}
    <TicketsManager events={events} onAssigned={refresh} />
  </section>
}
