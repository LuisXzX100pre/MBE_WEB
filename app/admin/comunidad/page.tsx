import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { CommunityManager } from '@/components/admin/community/community-manager'
export default async function AdminCommunityPage() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'ADMIN') redirect('/')
  return <div className="mx-auto max-w-6xl"><p className="mb-4 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">MBE / Interior</p><h1 className="mb-12 text-4xl font-black uppercase tracking-tighter">Comunidad.</h1><CommunityManager /></div>
}
