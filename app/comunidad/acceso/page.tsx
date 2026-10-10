import { redirect } from 'next/navigation'
import { communityAccess } from '@/lib/community/membership'
import { communityReturnPath } from '@/lib/community/access-link'
import { AccessForm } from '@/components/community/access-form'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
export const dynamic = 'force-dynamic'
export default async function CommunityAccessPage({ searchParams }: { searchParams: { code?: string | string[] } }) {
  const code = typeof searchParams.code === 'string' ? searchParams.code : ''
  const destination = communityReturnPath('/comunidad/acceso?code=' + encodeURIComponent(code))!
  const { user, membership } = await communityAccess()
  if (!user) redirect('/login?next=' + encodeURIComponent(destination))
  if (membership) redirect('/comunidad')
  return <div className="min-h-screen bg-[#080808] text-white"><Header />
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center px-6 pb-16 pt-32 sm:px-10">
      <p className="mb-6 text-[10px] uppercase tracking-[0.35em] text-white/40">MBE / Acceso exclusivo</p>
      <h1 className="text-5xl font-black uppercase leading-[0.9] tracking-tighter sm:text-7xl">MBE<br /><span className="text-white/35">Community.</span></h1>
      <p className="mb-10 mt-6 max-w-md text-sm leading-6 text-white/55">Lo que no sale afuera. Tu cuenta MBE es el inicio; tu código abre la puerta a Comunidad.</p>
      <AccessForm initialCode={new URL(destination, 'https://mbe.local').searchParams.get('code') || ''} />
    </main><Footer /></div>
}
