import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { publishedPosts } from '@/lib/community/posts'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { CommunityFeed } from '@/components/community/community-feed'
import type { Post } from '@/lib/community/types'
export const dynamic = 'force-dynamic'
export default async function CommunityPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/comunidad')
  const feed = await publishedPosts()
  return <div className="min-h-screen bg-[#080808] text-white"><Header /><main className="mx-auto max-w-7xl px-5 pb-24 pt-32 sm:px-8">
    <section className="relative mb-20 overflow-hidden border-b border-white/15 pb-16 pt-8">
      <div aria-hidden className="pointer-events-none absolute -right-8 top-0 text-[12rem] font-black leading-none tracking-tighter text-white/[0.025] md:text-[24rem]">MBE</div>
      <div className="relative"><div className="mb-10 flex items-center gap-3 text-[10px] uppercase tracking-[0.35em] text-white/50"><span className="h-1.5 w-1.5 bg-white" />Acceso concedido / {user.username}</div>
        <h1 className="max-w-4xl text-5xl font-black uppercase leading-[0.9] tracking-tighter sm:text-7xl md:text-8xl">MBE<br /><span className="text-white/35">Community.</span></h1>
        <p className="mt-8 text-xl font-medium">Lo que no sale afuera.</p><p className="mt-3 max-w-md text-sm leading-6 text-white/45">Adelantos, procesos y beneficios. Una mirada al interior de MBE, para quienes son parte.</p>
        <nav className="mt-10 flex flex-wrap gap-6 text-[10px] uppercase tracking-[0.25em]"><a href="#archivo" className="border-b border-white pb-2">01 / Archivo</a></nav>
      </div>
    </section><CommunityFeed initialPosts={JSON.parse(JSON.stringify(feed.posts)) as Post[]} initialCursor={feed.nextCursor} />
  </main><Footer /></div>
}
