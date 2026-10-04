import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export function CommunitySection({ communityCount }: { communityCount: number }) {
  const count = communityCount.toLocaleString('es-MX')
  const membershipLabel = communityCount === 1
    ? '1 persona está adentro'
    : count + ' personas están adentro'

  return (
    <section className="px-2 pb-2 pt-6 text-center text-white sm:px-8 sm:pb-4 sm:pt-8 md:pb-6 md:pt-12">
      <div className="mx-auto max-w-2xl">
        <h2 className="text-xl font-black uppercase tracking-tight sm:text-3xl md:text-4xl">
          MBE Community
        </h2>
        <p className="mt-2 text-sm font-medium sm:mt-3 sm:text-lg">
          Lo que no sale afuera.
        </p>
        <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-white/50 sm:max-w-lg sm:text-sm sm:leading-6">
          Adelantos, procesos y beneficios para los que están dentro.
        </p>
        <div className="mt-5 flex flex-col items-center sm:mt-7">
          <Link
            href="/comunidad"
            prefetch={false}
            className="inline-flex min-h-11 items-center justify-center gap-4 border border-white/30 px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors hover:bg-white hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:text-xs"
          >
            Comunidad Adentro
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <p className="mt-3 flex items-center justify-center gap-2 text-[10px] text-white/40 sm:text-xs">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current motion-safe:animate-pulse motion-safe:[animation-duration:3s]" />
            <span>{membershipLabel}</span>
          </p>
        </div>
      </div>
    </section>
  )
}
