'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useCart } from '@/contexts/cart-context'
import { ShoppingBag, User, Menu, X, LogOut, Package } from 'lucide-react'
import { CartSheet } from './cart-sheet'

export function Header() {
  const { user, logout } = useAuth()
  const { totalItems } = useCart()
  const [showCart, setShowCart] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="MBE Logo"
                width={100}
                height={40}
                className="object-contain h-10 w-auto"
              />
            </Link>

            {user && (
              <div className="md:hidden flex-1 flex justify-center">
                <span className="text-sm font-black tracking-tight text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                  {user.username}
                </span>
              </div>
            )}

            <nav className="hidden md:flex items-center gap-8">
              <Link
                href="/"
                className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-all hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
              >
                Inicio
              </Link>
              <Link
                href="/productos"
                className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-all hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
              >
                Productos
              </Link>
              <Link
                href="/categorias"
                className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-all hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
              >
                Categorias
              </Link>
              <Link
                href="/nosotros"
                className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-all hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]"
              >
                Nosotros
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              {user ? (
                <div className="hidden md:flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {user.username}
                  </span>

                  <Link
                    href="/mis-pedidos"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Package className="w-4 h-4" />
                    Mis pedidos
                  </Link>

                  {user.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Admin
                    </Link>
                  )}

                  <button
                    onClick={logout}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="hidden md:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <User className="w-5 h-5" />
                  <span>Iniciar sesion</span>
                </Link>
              )}

              <button
                onClick={() => setShowCart(true)}
                className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ShoppingBag className="w-5 h-5" />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              >
                {mobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-border">
              <nav className="flex flex-col gap-4">
                <Link
                  href="/"
                  className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Inicio
                </Link>
                <Link
                  href="/productos"
                  className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Productos
                </Link>
                <Link
                  href="/categorias"
                  className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Categorias
                </Link>
                <Link
                  href="/nosotros"
                  className="text-sm font-black tracking-tight text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Nosotros
                </Link>

                {user ? (
                  <>
                    <Link
                      href="/mis-pedidos"
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Mis pedidos
                    </Link>

                    {user.role === 'ADMIN' && (
                      <Link
                        href="/admin"
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
                    >
                      Cerrar sesion
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Iniciar sesion
                  </Link>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>

      <CartSheet open={showCart} onClose={() => setShowCart(false)} />
    </>
  )
}