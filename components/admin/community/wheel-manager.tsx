'use client'
import { useCallback, useEffect, useState } from 'react'
import { communityRequest, field, action } from './request'
type Campaign = { id: string; name: string; active: boolean; startsAt: string | null; endsAt: string | null; _count: { spins: number } }
type Spin = { id: string; discountPercent: number; createdAt: string; usedAt: string | null; user: { username: string } }
const empty = { name: '', active: false, startsAt: '', endsAt: '' }
const localDate = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
export function WheelManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]), [form, setForm] = useState(empty), [id, setId] = useState<string | null>(null), [spins, setSpins] = useState<Spin[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => setCampaigns(await communityRequest<Campaign[]>('/api/admin/community/campaigns')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [refresh])
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await communityRequest('/api/admin/community/campaigns' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', {
        ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      }); await refresh(); setForm(empty); setId(null)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar') }
    finally { setBusy(false) }
  }
  async function inspect(c: Campaign) {
    setError('')
    try { setSpins(await communityRequest<Spin[]>('/api/admin/community/spins?campaignId=' + c.id)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar') }
  }
  return <section><h2 className="mb-6 text-2xl font-black uppercase">Campanas / ruleta</h2>
    <p className="mb-6 text-xs text-white/40">Si varias campanas coinciden, se ofrece la mas reciente. Cada usuario conserva un giro por campana.</p>
    <form onSubmit={save} className="mb-10 grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-white/50">Nombre<input required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50">Inicio opcional / hora local<input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50">Fin opcional / hora local<input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Activa</label>
      <div className="flex gap-3"><button disabled={busy} className={action}>{id ? 'Guardar cambios' : 'Crear campana'}</button>{id && <button type="button" className={action} onClick={() => { setId(null); setForm(empty) }}>Cancelar</button>}</div>
    </form>{error && <p role="alert" className="text-red-400">{error}</p>}
    {campaigns.map(c => <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-5"><div><p className="font-bold">{c.name}</p><p className="mt-2 text-xs text-white/40">{c.active ? 'Activa' : 'Inactiva'} / {c._count.spins} giros</p></div><div className="flex gap-4 text-xs"><button onClick={() => { setId(c.id); setForm({ name: c.name, active: c.active, startsAt: localDate(c.startsAt), endsAt: localDate(c.endsAt) }) }}>Editar / activar</button><button onClick={() => inspect(c)}>Ver giros</button></div></div>)}
    <div className="mt-10">{spins.map(s => <div key={s.id} className="flex flex-wrap justify-between gap-3 border-t border-white/10 py-4 text-sm"><span>{s.user.username}</span><span>{s.discountPercent}% / {s.usedAt ? 'Usado' : 'Sin usar'}</span><time className="text-white/40">{new Date(s.createdAt).toLocaleString('es-MX')}</time></div>)}</div>
  </section>
}
