// components/admin/sidebar.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Tags,
  ShoppingCart,
  LogOut,
  Store,
} from 'lucide-react'

interface User {
  id: string
  username: string
  role: string
}

export function AdminSidebar({ user }: { user: User }) {
  const pathname = usePathname()

  const links = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/productos', label: 'Productos', icon: Package },
    { href: '/admin/categorias', label: 'Categorias', icon: Tags },
    { href: '/admin/ordenes', label: 'Ordenes', icon: ShoppingCart },
  ]

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <aside className="w-80 bg-card border-r border-border flex flex-col">
      {/* Logo - Coloca tu logo en /public/logo.png */}
      <div className="p-8 border-b border-border">
        <Link href="/admin" className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="MBE Logo"
            width={50}
            height={50}
            className="object-contain"
          />
          <span className="text-xl font-bold tracking-tighter">Admin</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-6 space-y-2">
        {links.map((link) => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-6 border-t border-border space-y-2">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          <Store className="w-5 h-5" />
          Ver tienda
        </Link>
        <div className="px-4 py-2">
          <p className="text-sm font-medium">{user.username}</p>
          <p className="text-xs text-muted-foreground">Administrador</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesion
        </button>
      </div>
    </aside>
  )
}
