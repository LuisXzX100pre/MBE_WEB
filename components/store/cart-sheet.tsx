// components/store/cart-sheet.tsx
'use client'

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

  if (!open) return null

  const handleCheckout = () => {
    if (!user) {
      router.push('/login')
      onClose()
      return
    }
    // Redirigir a checkout
    window.location.href = '/checkout'
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-background border-l border-border">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-bold">Carrito</h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items */}
          <div className="flex-1 overflow-y-auto p-4">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingBag className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Tu carrito esta vacio</p>
              </div>
            ) : (
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 p-3 bg-card rounded-lg border border-border"
                  >
                    <div className="relative w-20 h-20 bg-secondary rounded-md overflow-hidden flex-shrink-0">
                      {item.product.images[0] ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {item.product.name}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        ${item.product.price.toFixed(2)} MXN
                        {item.size && (
                          <span className="ml-2 px-2 py-0.5 bg-secondary rounded text-xs">
                            Talla {item.size}
                          </span>
                        )}
                      </p>

                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() =>
                            updateQuantity(
                              item.product.id,
                              Math.max(0, item.quantity - 1),
                              item.size || undefined
                            )
                          }
                          className="p-1 bg-secondary rounded hover:bg-muted transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="text-sm w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.product.id, item.quantity + 1, item.size || undefined)
                          }
                          className="p-1 bg-secondary rounded hover:bg-muted transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product.id, item.size || undefined)}
                          className="p-1 ml-auto text-destructive hover:bg-destructive/10 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="p-4 border-t border-border space-y-4">
              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>${totalPrice.toFixed(2)} MXN</span>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
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
