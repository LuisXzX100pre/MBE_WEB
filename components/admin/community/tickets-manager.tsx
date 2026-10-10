'use client'
import { useCallback, useEffect, useState } from 'react'
import { communityRequest, field, action } from './request'
type Ticket = { id: string; discountPercent: number; code: string; createdAt: string; expiresAt: string | null; usedAt: string | null; user: { username: string }; event: { title: string } }
export function TicketsManager({ events, onAssigned }: { events: { id: string; title: string; active: boolean }[]; onAssigned: () => Promise<void> }) {
  const [tickets, setTickets] = useState<Ticket[]>([]), [eventId, setEventId] = useState(''), [username, setUsername] = useState(''), [percent, setPercent] = useState(5), [expires, setExpires] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => setTickets(await communityRequest<Ticket[]>('/api/admin/community/tickets')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [refresh])
  async function assign(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await communityRequest('/api/admin/community/tickets', 'POST', { eventId, username, discountPercent: percent, expiresAt: expires ? new Date(expires).toISOString() : null })
      await refresh(); await onAssigned(); setUsername('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo asignar') }
    finally { setBusy(false) }
  }
  async function used(id: string) {
    if (!window.confirm('Marcar este ticket como usado?')) return
    setBusy(true); setError('')
    try { await communityRequest('/api/admin/community/tickets/' + id, 'PATCH'); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo actualizar') }
    finally { setBusy(false) }
  }
  return <div className="mt-14"><h3 className="mb-6 text-2xl font-black uppercase">Asignar ticket</h3>
    <form onSubmit={assign} className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-white/50">Evento<select required className={field + ' mt-2'} value={eventId} onChange={e => setEventId(e.target.value)}><option value="">Selecciona un evento</option>{events.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.title}</option>)}</select></label>
      <label className="text-xs text-white/50">Username exacto<input required maxLength={100} className={field + ' mt-2'} value={username} onChange={e => setUsername(e.target.value)} /></label>
      <label className="text-xs text-white/50">Descuento (%)<input required type="number" min={1} max={100} step={1} className={field + ' mt-2'} value={percent} onChange={e => setPercent(Number(e.target.value))} /></label>
      <label className="text-xs text-white/50">Expiracion opcional / hora local<input type="datetime-local" className={field + ' mt-2'} value={expires} onChange={e => setExpires(e.target.value)} /><span className="mt-2 block">Por defecto vence al terminar el evento.</span></label>
      <button disabled={busy} className={action}>Generar y asignar</button>
    </form>{error && <p role="alert" className="mt-4 text-red-400">{error}</p>}
    <p className="mb-4 mt-10 text-xs text-white/40">Ultimos 200 tickets entregados</p>
    {tickets.map(t => <div key={t.id} className="border-t border-white/10 py-5">
      <div className="flex flex-wrap justify-between gap-3"><p className="font-bold">{t.user.username} / {t.discountPercent}%</p>{!t.usedAt && (!t.expiresAt || new Date(t.expiresAt) > new Date()) && <button disabled={busy} className="text-xs" onClick={() => used(t.id)}>Marcar usado</button>}</div>
      <p className="my-2 text-xs text-white/50">{t.event.title} / {t.usedAt ? 'Usado: ' + new Date(t.usedAt).toLocaleString('es-MX') : 'Sin usar'}</p>
      <code className="break-all text-sm">{t.code}</code><p className="mt-2 text-xs text-white/40">Creado {new Date(t.createdAt).toLocaleString('es-MX')} / vence {t.expiresAt ? new Date(t.expiresAt).toLocaleString('es-MX') : 'sin fecha'}</p>
    </div>)}
  </div>
}
