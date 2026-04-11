'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { ShoppingBag, User, Menu, X, LogOut, Package } from 'lucide-react'
import { CartSheet } from './cart-sheet'

export function Header() {
  const { user, logout } = useAuth()
  const { totalItems } = useCart()
  const pathname = usePathname()

  const [showCart, setShowCart] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen])

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[80] border-b border-white/10 bg-black/95 supports-[backdrop-filter]:bg-black/80 supports-[backdrop-filter]:backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center shrink-0">
            <Image
              src="/logo.png"
              alt="MBE Logo"
              width={108}
              height={44}
              className="h-10 w-auto object-contain sm:h-11"
              priority
            />
          </Link>

          {user && (
            <div className="pointer-events-none md:hidden absolute left-1/2 -translate-x-1/2">
              <span className="max-w-[120px] truncate text-sm font-extrabold tracking-tight text-white">
                {user.username}
              </span>
            </div>
          )}

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-sm font-black tracking-tight text-muted-foreground transition-colors hover:text-foreground"
            >
              Inicio
            </Link>
            <Link
              href="/productos"
              className="text-sm font-black tracking-tight text-muted-foreground transition-colors hover:text-foreground"
            >
              Productos
            </Link>
            <Link
              href="/categorias"
              className="text-sm font-black tracking-tight text-muted-foreground transition-colors hover:text-foreground"
            >
              Categorias
            </Link>
            <Link
              href="/nosotros"
              className="text-sm font-black tracking-tight text-muted-foreground transition-colors hover:text-foreground"
            >
              Nosotros
            </Link>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            {user ? (
              <div className="hidden md:flex items-center gap-4">
                <span className="max-w-[140px] truncate text-sm text-muted-foreground">
                  {user.username}
                </span>

                <Link
                  href="/mis-pedidos"
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Package className="h-4 w-4" />
                  Mis pedidos
                </Link>

                {user.role === 'ADMIN' && (
                  <Link
                    href="/admin"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Admin
                  </Link>
                )}

                <button
                  onClick={logout}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Cerrar sesion"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="hidden md:flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <User className="h-5 w-5" />
                <span>Iniciar sesion</span>
              </Link>
            )}

            <button
              onClick={() => {
                setMobileMenuOpen(false)
                setShowCart(true)
              }}
              className="relative rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Abrir carrito"
            >
              <ShoppingBag className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {totalItems}
                </span>
              )}
            </button>

            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={mobileMenuOpen ? 'Cerrar menu' : 'Abrir menu'}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-[70] md:hidden overflow-y-auto bg-[#050505]"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 4rem)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
          }}
        >
          <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-6">
            <nav className="flex flex-col gap-5 border-b border-white/10 pb-6">
              <Link
                href="/"
                className="text-[15px] font-extrabold tracking-tight text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Inicio
              </Link>

              <Link
                href="/productos"
                className="text-[15px] font-extrabold tracking-tight text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Productos
              </Link>

              <Link
                href="/categorias"
                className="text-[15px] font-extrabold tracking-tight text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Categorias
              </Link>

              <Link
                href="/nosotros"
                className="text-[15px] font-extrabold tracking-tight text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                Nosotros
              </Link>

              {user ? (
                <>
                  <Link
                    href="/mis-pedidos"
                    className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Mis pedidos
                  </Link>

                  {user.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      logout()
                      setMobileMenuOpen(false)
                    }}
                    className="text-left text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Cerrar sesion
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Iniciar sesion
                </Link>
              )}
            </nav>

            <div className="pt-8">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-2xl font-black tracking-tight text-white">
                  Ultimos productos
                </h3>
                <Link
                  href="/productos"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-sm text-muted-foreground transition-colors hover:text-white"
                >
                  Ver todos →
                </Link>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Link
                  href="/productos"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-3xl border border-white/10 bg-card p-4 transition-colors hover:border-white/20"
                >
                  <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-2xl bg-secondary">
                    <Image
                      src="/uploads/product-1775785956506-tt1n17.jpeg"
                      alt="MBE producto"
                      fill
                      className="object-cover"
                    />
                  </div>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Camisetas
                  </p>
                  <p className="mt-2 text-lg font-black text-white">MBE 1</p>
                  <p className="mt-1 text-xl font-black text-white">$10.00 MXN</p>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <CartSheet open={showCart} onClose={() => setShowCart(false)} />
    </>
  )
}