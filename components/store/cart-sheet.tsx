// components/store/cart-sheet.tsx
'use client'

import { useEffect } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import { useAuth } from '@/contexts/auth-context'
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react'

interface CartSheetProps {
  open: boolean
  onClose: () => void
}

export function CartSheet({ open, onClose }: CartSheetProps) {
  const router = useRouter()
  const { user } = useAuth()
  const { items, totalPrice, updateQuantity, removeFromCart } = useCart()

  useEffect(() => {
    if (!open) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  if (!open) return null

  const handleCheckout = () => {
    if (!user) {
      onClose()
      router.push('/login')
      return
    }

    onClose()
    window.location.href = '/checkout'
  }

  return (
    <div
      className="fixed inset-0 z-[120]"
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute inset-y-0 right-0 w-full max-w-md border-l border-white/10 bg-background shadow-2xl">
        <div
          className="flex h-full flex-col"
          style={{
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-4 sm:px-5">
            <h2 className="text-lg font-bold text-white">Carrito</h2>

            <button
              onClick={onClose}
              aria-label="Cerrar carrito"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <ShoppingBag className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Tu carrito esta vacio</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-secondary">
                      {item.product.images[0] ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-medium text-white">
                        {item.product.name}
                      </h3>

                      <p className="mt-1 text-sm text-muted-foreground">
                        ${item.product.price.toFixed(2)} MXN
                        {item.size && (
                          <span className="ml-2 rounded px-2 py-0.5 text-xs bg-secondary">
                            Talla {item.size}
                          </span>
                        )}
                      </p>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              Math.max(0, item.quantity - 1),
                              item.size || undefined
                            )
                          }
                          className="rounded-lg bg-secondary p-2 transition-colors hover:bg-muted"
                          aria-label="Disminuir cantidad"
                        >
                          <Minus className="h-4 w-4" />
                        </button>

                        <span className="w-8 text-center text-sm">
                          {item.quantity}
                        </span>

                        <button
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              item.quantity + 1,
                              item.size || undefined
                            )
                          }
                          className="rounded-lg bg-secondary p-2 transition-colors hover:bg-muted"
                          aria-label="Aumentar cantidad"
                        >
                          <Plus className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() =>
                            removeFromCart(item.product.id, item.size || undefined)
                          }
                          className="ml-auto rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                          aria-label="Eliminar del carrito"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="space-y-4 border-t border-border px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>${totalPrice.toFixed(2)} MXN</span>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                Proceder al pago
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}