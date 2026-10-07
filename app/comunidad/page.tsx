import { redirect } from 'next/navigation'
import { enterCommunity } from '@/lib/community/membership'
import { publishedPosts } from '@/lib/community/posts'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { CommunityFeed } from '@/components/community/community-feed'
import { DiscountWheel } from '@/components/community/discount-wheel'
import { CommunityEvents } from '@/components/community/community-events'
import type { Post } from '@/lib/community/types'

export const dynamic = 'force-dynamic'

export default async function CommunityPage() {
  const { user, membership } = await enterCommunity()
  if (!user) redirect('/login?next=/comunidad')
  if (!membership) redirect('/comunidad/acceso')
  const feed = await publishedPosts()

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <Header />
      <main
        className="mx-auto max-w-7xl px-5 pb-12 sm:px-8 sm:pb-24"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 5.5rem)' }}
      >
        <section className="relative mb-7 overflow-hidden border-b border-white/15 pb-6 sm:mb-16 sm:pb-12 sm:pt-8 lg:mb-20 lg:pb-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-8 top-0 hidden font-black leading-none tracking-tighter text-white/[0.025] sm:block sm:text-[16rem] lg:text-[24rem]">
            MBE
          </div>
          <div className="relative">
            <h1 className="text-2xl font-black uppercase leading-none tracking-tight sm:max-w-4xl sm:text-6xl sm:leading-[0.9] sm:tracking-tighter lg:text-8xl">
              MBE <span className="sm:block sm:text-white/35">Community</span>
            </h1>
            <p className="mt-3 break-words text-xs text-white/50 sm:mt-6 sm:text-sm">
              Bienvenido adentro, {user.username}
            </p>
            <p className="mt-2 text-sm font-medium sm:mt-6 sm:text-xl">
              Lo que no sale afuera.
            </p>
            <p className="mt-3 hidden max-w-md text-sm leading-6 text-white/45 sm:block">
              Adelantos, procesos y beneficios. Una mirada al interior de MBE, para quienes son parte.
            </p>
            <nav aria-label="Secciones de Comunidad" className="mt-5 flex flex-wrap gap-5 text-[10px] uppercase tracking-[0.15em] sm:mt-8 sm:gap-8 sm:tracking-[0.25em]">
              <a href="#archivo" className="border-b border-white py-2">Archivo</a>
              <a href="#ruleta" className="py-2 text-white/60 hover:text-white">Ventajas</a>
              <a href="#eventos" className="py-2 text-white/60 hover:text-white">Eventos</a>
            </nav>
          </div>
        </section>
        <CommunityFeed initialPosts={JSON.parse(JSON.stringify(feed.posts)) as Post[]} initialCursor={feed.nextCursor} />
        <DiscountWheel />
        <CommunityEvents />
      </main>
      <Footer />
    </div>
  )
}
