'use client'
import { useCallback, useEffect, useState } from 'react'
import { communityRequest, action } from './request'
type Comment = { id: string; text: string; createdAt: string; user: { username: string }; post: { title: string } }
export function CommentsManager() {
  const [comments, setComments] = useState<Comment[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const refresh = useCallback(async () => setComments(await communityRequest<Comment[]>('/api/admin/community/comments')), [])
  useEffect(() => { refresh().catch(e => setError(e.message)) }, [refresh])
  async function remove(id: string) {
    if (!window.confirm('Eliminar este comentario?')) return
    setBusy(true); setError('')
    try { await communityRequest('/api/admin/community/comments/' + id, 'DELETE'); await refresh() }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo moderar') }
    finally { setBusy(false) }
  }
  return <section><h2 className="mb-8 text-2xl font-black uppercase">Moderacion / ultimos 200</h2>{error && <p role="alert" className="text-red-400">{error}</p>}
    {comments.map(c => <div key={c.id} className="flex flex-wrap items-start justify-between gap-4 border-t border-white/10 py-5"><div className="min-w-0 flex-1"><p className="text-xs text-white/45">{c.user.username} / {c.post.title} / {new Date(c.createdAt).toLocaleString('es-MX')}</p><p className="mt-3 whitespace-pre-wrap break-words">{c.text}</p></div><button disabled={busy} className={action} onClick={() => remove(c.id)}>Eliminar</button></div>)}
    {!comments.length && <p className="text-white/40">Sin comentarios.</p>}
  </section>
}
