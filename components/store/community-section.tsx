import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
export function CommunitySection() {
  return <section className="overflow-hidden border-y border-white/10 bg-[#080808] px-5 py-20 text-white sm:px-8 md:py-28">
    <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:items-end">
      <div><p className="mb-6 text-[10px] uppercase tracking-[0.35em] text-white/40">Acceso a otro nivel</p><h2 className="text-5xl font-black uppercase leading-[0.95] tracking-tighter sm:text-6xl">Comunidad<br /><span className="text-white/35">MBE.</span></h2></div>
      <div className="max-w-md"><p className="text-xl">Un espacio para los que estan dentro.</p><p className="mt-4 text-sm leading-7 text-white/50">Adelantos, procesos, beneficios y cosas que no publicamos afuera.</p><Link href="/comunidad" className="mt-8 inline-flex items-center gap-8 border-b border-white py-3 text-xs uppercase tracking-widest">Entrar a la comunidad<ArrowUpRight size={18} /></Link></div>
    </div>
  </section>
}
