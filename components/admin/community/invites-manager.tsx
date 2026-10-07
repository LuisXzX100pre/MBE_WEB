'use client'
import { useEffect, useRef, useState } from 'react'
import { communityRequest, field, action } from './request'
type Invite = { id: string; name: string; type: 'INDIVIDUAL' | 'CAMPAIGN'; maxUses: number; uses: number; active: boolean; expiresAt: string | null; createdAt: string }
type Redemption = { id: string; redeemedAt: string; user: { username: string } }
type InviteResponse = { invite: Invite; code?: string }
function responseInvite(result: InviteResponse, expectedId?: string) {
  const invite = result?.invite
  if (!invite || typeof invite.id !== 'string' || !invite.id || (expectedId && invite.id !== expectedId)) {
    throw new Error('La respuesta no contiene una invitación válida. Intenta nuevamente.')
  }
  return invite
}
const empty = { name: '', type: 'INDIVIDUAL' as Invite['type'], code: '', maxUses: 1, active: true, expiresAt: '' }
function localDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
export function inviteStatus(invite: Invite, now = Date.now()) {
  if (!invite.active) return 'INACTIVO'
  if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= now) return 'EXPIRADO'
  if (invite.uses >= invite.maxUses) return 'AGOTADO'
  return 'ACTIVO'
}
export function InvitesManager() {
  const [invites, setInvites] = useState<Invite[]>([]), [cursor, setCursor] = useState<string | null>(null)
  const [form, setForm] = useState(empty), [editing, setEditing] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(''), [busy, setBusy] = useState(true), [error, setError] = useState('')
  const [history, setHistory] = useState<{ invite: Invite; rows: Redemption[]; cursor: string | null } | null>(null)
  const sending = useRef(false)
  useEffect(() => {
    let mounted = true
    communityRequest<{ invites: Invite[]; nextCursor: string | null }>('/api/admin/community/invites')
      .then(result => { if (mounted) { setInvites(result.invites); setCursor(result.nextCursor) } })
      .catch(error => { if (mounted) setError(error.message) }).finally(() => { if (mounted) setBusy(false) })
    return () => { mounted = false }
  }, [])
  async function run(work: () => Promise<void>) {
    if (sending.current || busy) return
    sending.current = true; setBusy(true); setError('')
    try { await work() } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo completar la solicitud.') }
    finally { sending.current = false; setBusy(false) }
  }
  function reset() { setForm(empty); setEditing(null) }
  async function save(event: React.FormEvent) {
    event.preventDefault()
    await run(async () => {
      const payload = { ...form, expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null }
      const result = await communityRequest<InviteResponse>('/api/admin/community/invites' + (editing ? '/' + editing : ''), editing ? 'PATCH' : 'POST', payload)
      const updated = responseInvite(result, editing || undefined)
      setInvites(previous => editing ? previous.map(invite => invite.id === updated.id ? updated : invite) : [updated, ...previous])
      setRevealed(result.code || ''); reset()
    })
  }
  async function toggle(invite: Invite) {
    await run(async () => {
      const result = await communityRequest<InviteResponse>('/api/admin/community/invites/' + invite.id, 'PATCH', { active: !invite.active })
      const updated = responseInvite(result, invite.id)
      setInvites(previous => previous.map(item => item.id === updated.id ? updated : item))
    })
  }
  async function remove(invite: Invite) {
    if (busy || !window.confirm('¿Eliminar la invitación sin usos "' + invite.name + '"?')) return
    await run(async () => {
      await communityRequest('/api/admin/community/invites/' + invite.id, 'DELETE')
      setInvites(previous => previous.filter(item => item.id !== invite.id))
      if (history?.invite.id === invite.id) setHistory(null)
      if (editing === invite.id) reset()
    })
  }
  async function loadHistory(invite: Invite, next?: string) {
    await run(async () => {
      const result = await communityRequest<{ redemptions: Redemption[]; nextCursor: string | null }>('/api/admin/community/invites/' + invite.id + (next ? '?cursor=' + encodeURIComponent(next) : ''))
      setHistory(previous => ({ invite, rows: next && previous?.invite.id === invite.id ? [...previous.rows, ...result.redemptions] : result.redemptions, cursor: result.nextCursor }))
    })
  }
  return <section className="grid gap-10 xl:grid-cols-[1fr_1.2fr]" aria-busy={busy}>
    <div className="space-y-6">
      <form onSubmit={save} className="space-y-4">
        <h2 className="text-2xl font-black uppercase">{editing ? 'Editar invitación' : 'Crear acceso'}</h2>
        <label className="block text-xs text-white/50">Etiqueta / campaña<input required maxLength={80} value={form.name} disabled={busy} onChange={e => setForm({ ...form, name: e.target.value })} className={field + ' mt-2'} /></label>
        <p className="text-xs text-white/40">Usa una etiqueta distinta al código que compartirás.</p>
        <label className="block text-xs text-white/50">Tipo<select disabled={busy || !!editing} value={form.type} onChange={e => setForm({ ...form, type: e.target.value as Invite['type'], maxUses: e.target.value === 'INDIVIDUAL' ? 1 : 25 })} className={field + ' mt-2'}><option value="INDIVIDUAL">Individual · 1 acceso</option><option value="CAMPAIGN">Campaña · varios accesos</option></select></label>
        {!editing && <label className="block text-xs text-white/50">Código personalizado (opcional)<input maxLength={64} minLength={8} autoComplete="off" spellCheck={false} disabled={busy} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className={field + ' mt-2'} /><span className="mt-2 block">Vacío = código aleatorio. Letras, números y guiones; 8–64 caracteres.</span></label>}
        <label className="block text-xs text-white/50">Máximo de usos<input type="number" required min={1} max={10000} disabled={busy || form.type === 'INDIVIDUAL'} value={form.maxUses} onChange={e => setForm({ ...form, maxUses: Number(e.target.value) })} className={field + ' mt-2'} /></label>
        <label className="block text-xs text-white/50">Expiración opcional (hora local)<input type="datetime-local" disabled={busy} value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} className={field + ' mt-2'} /></label>
        <label className="flex gap-3 text-sm"><input type="checkbox" disabled={busy} checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />Activo</label>
        <div className="flex flex-wrap gap-3"><button disabled={busy} className={action}>{busy ? 'Procesando...' : 'Guardar acceso'}</button>{editing && <button type="button" disabled={busy} className={action} onClick={reset}>Cancelar</button>}</div>
      </form>
      {revealed && <div className="space-y-3 border border-[#a33b50] bg-[#761b2b]/20 p-5" role="status">
        <p className="text-xs uppercase tracking-widest">Cópialo ahora. No podrás recuperarlo después.</p>
        <code className="block break-all text-lg">{revealed}</code>
        <button className={action} onClick={() => setRevealed('')}>Ya lo copié · ocultar</button>
      </div>}
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {busy && <p role="status" className="text-xs text-white/40">Cargando accesos...</p>}
    </div>
    <div>
      {!busy && !invites.length && <p className="text-sm text-white/50">No hay invitaciones todavía. Prepara el primer acceso aquí.</p>}
      {invites.map(invite => <article key={invite.id} className="space-y-3 border-t border-white/15 py-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">{invite.type === 'INDIVIDUAL' ? 'Individual' : 'Campaña'} / {inviteStatus(invite)}</p>
        <h3 className="break-words text-xl font-bold">{invite.name}</h3>
        <p className="text-sm">{invite.uses} / {invite.maxUses} accesos</p>
        <p className="text-xs text-white/40">Creado: {new Date(invite.createdAt).toLocaleString()}<br />Expira: {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'Sin expiración'}</p>
        <div className="flex flex-wrap gap-4 text-xs">
          <button disabled={busy} onClick={() => { setEditing(invite.id); setRevealed(''); setForm({ name: invite.name, type: invite.type, code: '', maxUses: invite.maxUses, active: invite.active, expiresAt: localDate(invite.expiresAt) }) }}>Editar</button>
          <button disabled={busy} onClick={() => toggle(invite)}>{invite.active ? 'Desactivar' : 'Activar'}</button>
          <button disabled={busy} onClick={() => loadHistory(invite)}>Ver usos</button>
          <button disabled={busy || invite.uses > 0} onClick={() => remove(invite)} className="text-red-300 disabled:opacity-30">Eliminar</button>
        </div>
      </article>)}
      {cursor && <button disabled={busy} className={action} onClick={() => run(async () => {
        const result = await communityRequest<{ invites: Invite[]; nextCursor: string | null }>('/api/admin/community/invites?cursor=' + encodeURIComponent(cursor))
        setInvites(previous => [...previous, ...result.invites.filter(item => !previous.some(existing => existing.id === item.id))]); setCursor(result.nextCursor)
      })}>Más invitaciones</button>}
      {history && <div className="mt-8 space-y-3 border border-white/15 p-5">
        <h3 className="font-bold">Usos · {history.invite.name}</h3>
        {!history.rows.length && <p className="text-sm text-white/40">Sin redenciones todavía.</p>}
        {history.rows.map(row => <p key={row.id} className="break-words text-sm">{row.user.username}<span className="ml-3 text-xs text-white/40">{new Date(row.redeemedAt).toLocaleString()}</span></p>)}
        {history.cursor && <button disabled={busy} className={action} onClick={() => loadHistory(history.invite, history.cursor!)}>Más usos</button>}
        <button disabled={busy} className={action} onClick={() => setHistory(null)}>Cerrar historial</button>
      </div>}
    </div>
  </section>
}
