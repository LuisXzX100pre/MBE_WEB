'use client'
import { useState } from 'react'
import type { Comment } from '@/lib/community/types'
export function CommunityComments({ postId, initial }: { postId: string; initial: Comment[] }) {
  const [comments, setComments] = useState(initial), [content, setContent] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [more, setMore] = useState(initial.length === 20)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const res = await fetch('/api/community/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postId, text: content }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComments(prev => [data, ...prev]); setContent('')
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo comentar') }
    finally { setBusy(false) }
  }
  async function older() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/community/comments?postId=' + encodeURIComponent(postId) + '&cursor=' + encodeURIComponent(comments[comments.length - 1].id))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setComments(prev => [...prev, ...data.comments]); setMore(Boolean(data.nextCursor))
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar') }
    finally { setBusy(false) }
  }
  return <div className="border-t border-white/10 pt-6">
    <p className="mb-5 text-[10px] uppercase tracking-[0.3em] text-white/40">La voz de adentro</p>
    <div className="max-h-72 space-y-5 overflow-y-auto">{comments.map(c => <div key={c.id} className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center border border-white/15 text-xs">{c.user.username.slice(0, 1).toUpperCase()}</span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap gap-3 text-xs"><span className="font-bold">{c.user.username}</span><time dateTime={c.createdAt} className="text-white/35">{new Date(c.createdAt).toLocaleDateString('es-MX', { timeZone: 'America/Cancun' })}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/70">{c.text}</p></div>
    </div>)}</div>
    {more && <button disabled={busy} onClick={older} className="mt-4 text-xs text-white/50 underline">Ver comentarios anteriores</button>}
    <form onSubmit={submit} className="mt-6 flex items-end gap-3">
      <label className="flex-1 text-xs text-white/50">Deja tu comentario<textarea required maxLength={1000} value={content} onChange={e => setContent(e.target.value)} rows={2} className="mt-2 w-full resize-y border-b border-white/20 bg-transparent p-2 text-sm text-white outline-none focus:border-white" placeholder="Tu perspectiva cuenta." /></label>
      <button disabled={busy || !content.trim()} className="border border-white/30 px-4 py-3 text-xs uppercase tracking-widest disabled:opacity-30">{busy ? 'Enviando...' : 'Enviar'}</button>
    </form>{error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
  </div>
}
