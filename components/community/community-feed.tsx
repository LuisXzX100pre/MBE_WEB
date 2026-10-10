'use client'
import { useState } from 'react'
import type { Post } from '@/lib/community/types'
import { CommunityPost } from './community-post'
export function CommunityFeed({ initialRecentPosts = [], initialPosts, initialCursor }: { initialRecentPosts?: Post[]; initialPosts: Post[]; initialCursor: string | null }) {
  const [recent, setRecent] = useState(initialRecentPosts), [posts, setPosts] = useState(initialPosts), [cursor, setCursor] = useState(initialCursor), [busy, setBusy] = useState(false), [error, setError] = useState(''), [archiveOpen, setArchiveOpen] = useState(false)
  async function load() {
    if (busy || !cursor) return
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/community/posts?cursor=' + encodeURIComponent(cursor)), data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const current: Post[] = data.recentPosts
      const recentIds = new Set(current.map(post => post.id))
      setRecent(current)
      setPosts(prev => {
        const unique = new Map<string, Post>()
        for (const post of [...prev, ...data.posts]) if (!recentIds.has(post.id)) unique.set(post.id, post)
        return [...unique.values()]
      })
      setCursor(data.nextCursor)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar') }
    finally { setBusy(false) }
  }
  return <>
    <section id="ultimos" className="scroll-mt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl font-black uppercase tracking-tight">Lo último en MBE</h2><span className="text-[10px] uppercase tracking-[0.3em] text-white/35">Members only</span></div>
      {!recent.length && <div className="border-y border-white/10 py-16"><p className="text-2xl font-black uppercase sm:text-3xl">El siguiente movimiento nace aquí.</p><p className="mt-4 text-sm text-white/50">Vuelve pronto para descubrir lo último en MBE.</p></div>}
      {recent.map((post, index) => <CommunityPost key={post.id} post={post} index={index} />)}
    </section>
    <section id="archivo" className="my-12 scroll-mt-24 border-t border-white/15 pt-8 sm:my-16">
      <h2 className="text-2xl font-black uppercase tracking-tight">Archivo MBE</h2>
      <p className="mt-3 max-w-lg text-sm leading-6 text-white/50">Más historias, procesos y momentos de MBE. Todo sigue adentro.</p>
      <button type="button" aria-expanded={archiveOpen} aria-controls="archivo-publicaciones" onClick={() => setArchiveOpen(open => !open)} className="my-6 border border-white/25 px-8 py-4 text-xs uppercase tracking-widest">{archiveOpen ? 'Cerrar archivo' : 'Ver archivo'}</button>
      {archiveOpen && <div id="archivo-publicaciones">
        {!posts.length && <p className="border-y border-white/10 py-10 text-sm text-white/50">El archivo empieza con los próximos movimientos.</p>}
        {posts.map((post, index) => <CommunityPost key={post.id} post={post} index={index} />)}
        {cursor && <button type="button" disabled={busy} onClick={load} className="my-6 border border-white/25 px-8 py-4 text-xs uppercase tracking-widest">{busy ? 'Cargando...' : 'Abrir más archivos'}</button>}
        {error && <p role="alert" className="text-red-400">{error}</p>}
      </div>}
    </section>
  </>
}
