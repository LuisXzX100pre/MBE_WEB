// app/admin/layout.tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AdminSidebar } from '@/components/admin/sidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user || user.role !== 'ADMIN') {
    redirect('/')
  }

  return (
    <div className="min-h-screen flex">
      <AdminSidebar user={user} />
      <main className="flex-1 p-8 bg-background">{children}</main>
    </div>
  )
}
