'use client'
import { useRef, useState } from 'react'
import Image from 'next/image'
import type { Post } from '@/lib/community/types'
import { CommunityComments } from './community-comments'
export function CommunityPost({ post, index }: { post: Post; index: number }) {
  const [selectedId, setSelectedId] = useState('')
  const drag = useRef<{ x: number; y: number; id: number } | null>(null)
  const suppressClickUntil = useRef(0)
  const images = post.mediaType === 'IMAGE' && post.media?.length ? post.media : []
  const activeIndex = Math.max(0, images.findIndex(image => image.id === selectedId))
  const count = images.length || 1
  const imageUrl = '/api/community/media/' + post.id + (images.length ? '?mediaId=' + encodeURIComponent(images[activeIndex].id) : '')
  function navigate(next: number) { if (images.length) setSelectedId(images[(next + images.length) % images.length].id) }
  return <article className="border-t border-white/15 py-10 md:py-14">
    <div className="mb-6 flex justify-between text-[10px] uppercase tracking-[0.25em] text-white/40"><span>Archivo {String(index + 1).padStart(3, '0')} / {post.mediaType === 'VIDEO' ? 'Film' : 'Imagen'}</span><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('es-MX', { timeZone: 'America/Cancun' })}</time></div>
    <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12"><div className="min-w-0">
      {post.mediaType === 'IMAGE' ? <div data-community-gallery role="group" aria-label={'Imágenes de ' + post.title} aria-roledescription="carrusel" className="mx-auto w-full max-w-[min(420px,48vh)]" style={{ touchAction: 'pan-y pinch-zoom' }}
        onPointerDown={event => {
          event.stopPropagation()
          if (count < 2 || event.pointerType !== 'touch' || !event.isPrimary || (event.target as Element).closest?.('button,a,input,textarea,select,[contenteditable]')) return
          drag.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
          event.currentTarget.setPointerCapture?.(event.pointerId)
        }}
        onPointerUp={event => {
          event.stopPropagation()
          const start = drag.current; drag.current = null
          if (!start || start.id !== event.pointerId) return
          const dx = event.clientX - start.x, dy = event.clientY - start.y
          if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) { navigate(activeIndex + (dx < 0 ? 1 : -1)); suppressClickUntil.current = Date.now() + 350 }
        }}
        onPointerCancel={event => { event.stopPropagation(); drag.current = null }}
        onClickCapture={event => { if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation() } }}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
          <Image key={imageUrl} src={imageUrl} alt={post.title + (count > 1 ? ` · imagen ${activeIndex + 1} de ${count}` : '')} width={1200} height={1500} unoptimized loading="lazy" className="h-full w-full object-contain object-center" />
          {count > 1 && <><button type="button" aria-label="Imagen anterior" onClick={() => navigate(activeIndex - 1)} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white">←</button><button type="button" aria-label="Imagen siguiente" onClick={() => navigate(activeIndex + 1)} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/60 text-white">→</button></>}
        </div>
        {count > 1 && <div className="mt-2 flex items-center justify-center gap-2"><span className="text-xs text-white/50" aria-live="polite">{activeIndex + 1} / {count}</span>{images.map((image, i) => <button key={image.id} type="button" aria-label={`Ver imagen ${i + 1}`} aria-current={i === activeIndex ? 'true' : undefined} onClick={() => navigate(i)} className="flex h-11 w-8 items-center justify-center"><span aria-hidden="true" className={'h-2 w-2 rounded-full ' + (i === activeIndex ? 'bg-white' : 'bg-white/30')} /></button>)}</div>}
      </div> : <div className="overflow-hidden bg-white/[0.025]"><video src={'/api/community/media/' + post.id} poster={post.thumbnailUrl || undefined} controls playsInline preload="none" className="max-h-[70vh] w-full" /></div>}
    </div><div><h3 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">{post.title}</h3><p className="my-6 whitespace-pre-wrap text-sm leading-7 text-white/55">{post.description}</p><CommunityComments postId={post.id} initial={post.comments} /></div></div>
  </article>
}
