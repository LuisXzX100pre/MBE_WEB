'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { communityRequest, field, action } from './request'
import { prizeConfig, wheelPrizes, type CampaignView } from '@/lib/community/wheel-config'
type Campaign = CampaignView & { active: boolean; _count: { spins: number } }
type Spin = { id: string; discountPercent: number; createdAt: string; usedAt: string | null; user: { username: string } }
const empty = { name: '', title: '', subtitle: '', description: '', note: '', active: false, startsAt: '', endsAt: '', prizeWeights: wheelPrizes.map(p => ({ ...p })) }
const localDate = (value: string | null) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
export function campaignStatus(c: Campaign, now = Date.now()) {
  if (!c.active) return 'INACTIVA'
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return 'VENCIDA'
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return 'PROGRAMADA'
  return 'EN CURSO'
}
export function WheelManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]), [form, setForm] = useState(empty), [id, setId] = useState<string | null>(null)
  const [inspected, setInspected] = useState<Campaign | null>(null), [spins, setSpins] = useState<Spin[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(true)
  const pending = useRef(false)
  const refresh = useCallback(async () => setCampaigns(await communityRequest<Campaign[]>('/api/admin/community/campaigns')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setBusy(false)) }, [refresh])
  async function run(work: () => Promise<void>) {
    if (busy || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await work() } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la solicitud') }
    finally { pending.current = false; setBusy(false) }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    await run(async () => {
      await communityRequest('/api/admin/community/campaigns' + (id ? '/' + id : ''), id ? 'PATCH' : 'POST', {
        ...form, startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null, endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      }); await refresh(); setForm(empty); setId(null)
    })
  }
  function edit(c: Campaign) {
    setId(c.id); setForm({ name: c.name, title: c.title || c.name, subtitle: c.subtitle || 'Un giro por miembro.', description: c.description || 'Tu resultado se conserva en tu cuenta.', note: c.note || '', active: c.active, startsAt: localDate(c.startsAt), endsAt: localDate(c.endsAt), prizeWeights: prizeConfig(c.prizeWeights) })
  }
  async function toggle(c: Campaign) {
    await run(async () => {
      await communityRequest('/api/admin/community/campaigns/' + c.id, 'PATCH', { active: !c.active }); await refresh()
      if (id === c.id) setForm(previous => ({ ...previous, active: !c.active }))
    })
  }
  async function inspect(c: Campaign) {
    await run(async () => { const rows = await communityRequest<Spin[]>('/api/admin/community/spins?campaignId=' + encodeURIComponent(c.id)); setSpins(rows); setInspected(c) })
  }
  const totalWeight = form.prizeWeights.reduce((sum, p) => sum + p.weight, 0)
  return <section aria-busy={busy}>
    <h2 className="mb-3 text-2xl font-black uppercase">Campañas / ruleta</h2>
    <p className="mb-8 max-w-xl text-xs leading-6 text-white/45">Selecciona una campaña y dale un motivo al giro. Activarla desactiva las demás, incluso si su inicio es futuro. Cada miembro conserva un resultado por campaña.</p>
    <form onSubmit={save} className="mb-10 grid gap-4 sm:grid-cols-2">
      <label className="text-xs text-white/50">Nombre interno<input required disabled={busy} maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50">Título visible<input required disabled={busy} maxLength={160} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50 sm:col-span-2">Frase principal<input required disabled={busy} maxLength={240} value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50 sm:col-span-2">Descripción / motivo<textarea required disabled={busy} rows={3} maxLength={1500} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50 sm:col-span-2">Nota breve (opcional)<input disabled={busy} maxLength={240} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50">Inicio opcional / hora local<input type="datetime-local" disabled={busy} value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} className={field + ' mt-2'} /></label>
      <label className="text-xs text-white/50">Fin opcional / hora local<input type="datetime-local" disabled={busy} value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} className={field + ' mt-2'} /></label>
      <fieldset disabled={busy} className="min-w-0 border border-white/15 p-4 sm:col-span-2"><legend className="px-2 text-xs">Premios / probabilidades</legend><p className="mb-4 text-xs text-white/40">Peso relativo: 1 en cada opción = 25% por premio. Cambiar pesos afecta solo giros futuros.</p><div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{form.prizeWeights.map((prize, index) => <label key={prize.percent} className="text-xs text-white/50">{prize.percent}% OFF<input type="number" required min={1} max={1000} value={prize.weight} className={field + ' mt-2'} onChange={e => setForm({ ...form, prizeWeights: form.prizeWeights.map((p, i) => i === index ? { ...p, weight: Number(e.target.value) } : p) })} /><span className="mt-2 block">{totalWeight > 0 ? (prize.weight / totalWeight * 100).toFixed(1) : '0'}% probabilidad</span></label>)}</div></fieldset>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" disabled={busy} checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Seleccionar como activa</label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button disabled={busy} className={action}>{busy ? 'Procesando...' : id ? 'Guardar cambios' : 'Crear campaña'}</button>{id && <button type="button" disabled={busy} className={action} onClick={() => { setId(null); setForm(empty) }}>Cancelar</button>}</div>
    </form>
    {error && <p role="alert" className="mb-6 text-red-300">{error}</p>}
    {!busy && !campaigns.length && <p className="border-t border-white/15 py-6 text-sm text-white/50">No hay campañas todavía. Prepara el próximo movimiento arriba.</p>}
    {campaigns.map(c => <article key={c.id} className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-5"><div className="min-w-0"><p className="break-words font-bold">{c.title || c.name}</p><p className="mt-2 break-words text-xs text-white/40">{c.name} / {campaignStatus(c)} / {c._count.spins} giros</p><p className="mt-2 text-[10px] text-white/35">{c.startsAt ? new Date(c.startsAt).toLocaleString('es-MX') : 'Sin inicio'} → {c.endsAt ? new Date(c.endsAt).toLocaleString('es-MX') : 'Sin fin'}</p></div><div className="flex flex-wrap gap-4 text-xs"><button disabled={busy} onClick={() => edit(c)}>Editar</button><button disabled={busy} onClick={() => toggle(c)}>{c.active ? 'Desactivar' : 'Activar'}</button><button disabled={busy} onClick={() => inspect(c)}>Ver resultados</button></div></article>)}
    {inspected && <div className="mt-8 border border-white/15 p-5"><h3 className="break-words font-bold">Resultados / {inspected.title || inspected.name}</h3><p className="my-3 text-xs text-white/45">{inspected._count.spins} giros totales. Mostrando los últimos {spins.length} (máximo 500); {spins.filter(s => s.usedAt).length} marcados como utilizados en esta lista.</p><div className="mb-5 flex flex-wrap gap-4 text-xs text-white/50">{wheelPrizes.map(p => <span key={p.percent}>{p.percent}% OFF: {spins.filter(s => s.discountPercent === p.percent).length}</span>)}</div>{spins.map(s => <div key={s.id} className="flex flex-wrap justify-between gap-3 border-t border-white/10 py-4 text-sm"><span className="break-all">{s.user.username}</span><span>{s.discountPercent}% / {s.usedAt ? 'Usado' : 'Sin usar'}</span><time className="text-xs text-white/40">{new Date(s.createdAt).toLocaleString('es-MX')}</time></div>)}<button disabled={busy} className={action} onClick={() => { setInspected(null); setSpins([]) }}>Cerrar resultados</button></div>}
  </section>
}
