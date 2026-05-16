'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { ShoppingBag, User, Menu, X, LogOut, Package, ArrowRight } from 'lucide-react'
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
    if (mobileMenuOpen || showCart) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileMenuOpen, showCart])

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-[80] border-b border-white/10 bg-black/95 supports-[backdrop-filter]:bg-black/80 supports-[backdrop-filter]:backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center" onClick={closeMobileMenu}>
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
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 md:hidden">
              <span className="block max-w-[120px] truncate text-sm font-extrabold tracking-tight text-white">
                {user.username}
              </span>
            </div>
          )}

          <nav className="hidden items-center gap-8 md:flex">
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
              <div className="hidden items-center gap-4 md:flex">
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
                className="hidden items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
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
              className="rounded-full p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden"
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
          className="fixed inset-x-0 bottom-0 z-[70] overflow-y-auto bg-[#050505] md:hidden"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 4rem)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
          }}
        >
          <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-7">
            <nav className="flex flex-col gap-5 border-b border-white/10 pb-7">
              <Link
                href="/"
                className="text-[16px] font-extrabold tracking-tight text-foreground"
                onClick={closeMobileMenu}
              >
                Inicio
              </Link>

              <Link
                href="/productos"
                className="text-[16px] font-extrabold tracking-tight text-foreground"
                onClick={closeMobileMenu}
              >
                Productos
              </Link>

              <Link
                href="/categorias"
                className="text-[16px] font-extrabold tracking-tight text-foreground"
                onClick={closeMobileMenu}
              >
                Categorias
              </Link>

              <Link
                href="/nosotros"
                className="text-[16px] font-extrabold tracking-tight text-foreground"
                onClick={closeMobileMenu}
              >
                Nosotros
              </Link>

              {user ? (
                <>
                  <Link
                    href="/mis-pedidos"
                    className="text-[16px] text-muted-foreground transition-colors hover:text-foreground"
                    onClick={closeMobileMenu}
                  >
                    Mis pedidos
                  </Link>

                  {user.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      className="text-[16px] text-muted-foreground transition-colors hover:text-foreground"
                      onClick={closeMobileMenu}
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      logout()
                      closeMobileMenu()
                    }}
                    className="text-left text-[16px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Cerrar sesion
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-[16px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={closeMobileMenu}
                >
                  Iniciar sesion
                </Link>
              )}
            </nav>

            <div className="mt-7 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                MBE Store
              </p>

              <h3 className="mt-3 text-2xl font-black tracking-tight text-white">
                Explora la colección
              </h3>

              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Entra a productos para ver las piezas reales disponibles, próximos drops y artículos activos de la tienda.
              </p>

              <Link
                href="/productos"
                onClick={closeMobileMenu}
                className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-black text-black transition-all hover:scale-[1.02] hover:bg-white/90"
              >
                Ver productos
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <CartSheet open={showCart} onClose={() => setShowCart(false)} />
    </>
  )
}