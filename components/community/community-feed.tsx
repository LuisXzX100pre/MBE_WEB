'use client'
import { useState } from 'react'
import type { Post } from '@/lib/community/types'
import { CommunityPost } from './community-post'
export function CommunityFeed({ initialPosts, initialCursor }: { initialPosts: Post[]; initialCursor: string | null }) {
  const [posts, setPosts] = useState(initialPosts), [cursor, setCursor] = useState(initialCursor), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function load() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/community/posts?cursor=' + encodeURIComponent(cursor || '')), data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPosts(prev => [...prev, ...data.posts]); setCursor(data.nextCursor)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar') }
    finally { setBusy(false) }
  }
  return <section id="archivo" className="scroll-mt-24">
    <div className="mb-8 flex items-end justify-between"><h2 className="text-2xl font-black uppercase tracking-tight">Feed exclusivo</h2><span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Members only</span></div>
    {!posts.length && <div className="border-y border-white/10 py-20"><p className="text-3xl font-black uppercase">El siguiente movimiento nace aqui.</p><p className="mt-4 text-sm text-white/50">Estamos preparando el primer archivo. Vuelve pronto.</p></div>}
    {posts.map((post, index) => <CommunityPost key={post.id} post={post} index={index} />)}
    {cursor && <button disabled={busy} onClick={load} className="my-6 border border-white/25 px-8 py-4 text-xs uppercase tracking-widest">{busy ? 'Cargando...' : 'Abrir mas archivos'}</button>}
    {error && <p role="alert" className="text-red-400">{error}</p>}
  </section>
}
