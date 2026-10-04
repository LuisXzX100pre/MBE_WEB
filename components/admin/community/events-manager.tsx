'use client'
import { useCallback, useEffect, useState } from 'react'
import { communityRequest, field, action } from './request'
import { TicketsManager } from './tickets-manager'
type Event = { id: string; title: string; description: string; active: boolean; startsAt: string; endsAt: string; _count: { tickets: number } }
const empty = { title: '', description: '', active: false, startsAt: '', endsAt: '' }
const localDate = (value: string) => new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
export function EventsManager() {
  const [events, setEvents] = useState<Event[]>([]), [form, setForm] = useState(empty), [id, setId] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const refresh = useCallback(async () => setEvents(await communityRequest<Event[]>('/api/admin/community/events')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [refresh])
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await communityRequest('/api/admin/community/events' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', { ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() }); await refresh(); setId(null); setForm(empty) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  return <section><h2 className="mb-6 text-2xl font-black uppercase">Eventos sorpresa</h2>
    <form onSubmit={save} className="mb-10 grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-white/50">Titulo<input required maxLength={160} className={field + ' mt-2'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
      <label className="text-xs text-white/50">Descripcion<textarea required maxLength={3000} className={field + ' mt-2'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
      <label className="text-xs text-white/50">Inicio / hora local<input required type="datetime-local" className={field + ' mt-2'} value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></label>
      <label className="text-xs text-white/50">Fin / hora local<input required type="datetime-local" className={field + ' mt-2'} value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Activo</label>
      <div className="flex flex-wrap gap-3"><button disabled={busy} className={action}>{id ? 'Guardar cambios' : 'Crear evento'}</button>{id && <button type="button" className={action} onClick={() => { setId(null); setForm(empty) }}>Cancelar</button>}</div>
    </form>{error && <p role="alert" className="text-red-400">{error}</p>}
    {events.map(e => <div key={e.id} className="flex flex-wrap justify-between gap-4 border-t border-white/10 py-5"><div><p className="font-bold">{e.title}</p><p className="mt-2 text-xs text-white/40">{e.active ? 'Activo' : 'Inactivo'} / {e._count.tickets} tickets / {new Date(e.startsAt).toLocaleString('es-MX')}</p></div><button className="text-xs" onClick={() => { setId(e.id); setForm({ title: e.title, description: e.description, active: e.active, startsAt: localDate(e.startsAt), endsAt: localDate(e.endsAt) }) }}>Editar / activar</button></div>)}
    <TicketsManager events={events} onAssigned={refresh} />
  </section>
}
