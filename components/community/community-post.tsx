import Image from 'next/image'
import type { Post } from '@/lib/community/types'
import { CommunityComments } from './community-comments'
export function CommunityPost({ post, index }: { post: Post; index: number }) {
  return <article className="border-t border-white/15 py-10 md:py-14">
    <div className="mb-6 flex justify-between text-[10px] uppercase tracking-[0.25em] text-white/40"><span>Archivo {String(index + 1).padStart(3, '0')} / {post.mediaType === 'VIDEO' ? 'Film' : 'Imagen'}</span><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('es-MX', { timeZone: 'America/Cancun' })}</time></div>
    <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:gap-12"><div className="overflow-hidden bg-white/[0.025]">
      {post.mediaType === 'IMAGE' ? <Image src={'/api/community/media/' + post.id} alt={post.title} width={1200} height={1200} unoptimized loading="lazy" className="h-auto w-full object-contain" /> : <video src={'/api/community/media/' + post.id} poster={post.thumbnailUrl || undefined} controls playsInline preload="none" className="max-h-[70vh] w-full" />}
    </div><div><h3 className="text-3xl font-black uppercase tracking-tight sm:text-4xl">{post.title}</h3><p className="my-6 whitespace-pre-wrap text-sm leading-7 text-white/55">{post.description}</p><CommunityComments postId={post.id} initial={post.comments} /></div></div>
  </article>
}
