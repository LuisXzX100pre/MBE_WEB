// contexts/cart-context.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './auth-context'

interface CartItem {
  id: string
  quantity: number
  size: string | null
  product: {
    id: string
    name: string
    price: number
    images: { url: string }[]
  }
}

interface CartContextType {
  items: CartItem[]
  loading: boolean
  addToCart: (productId: string, quantity?: number, size?: string) => Promise<{ success: boolean; requiresAuth?: boolean }>
  removeFromCart: (productId: string, size?: string) => Promise<void>
  updateQuantity: (productId: string, quantity: number, size?: string) => Promise<void>
  clearCart: () => Promise<void>
  refreshCart: () => Promise<void>
  totalItems: number
  totalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)

  const refreshCart = async () => {
    if (!user) {
      setItems([])
      return
    }

    try {
      setLoading(true)
      const res = await fetch('/api/cart')
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshCart()
  }, [user])

  const addToCart = async (productId: string, quantity = 1, size?: string) => {
    if (!user) {
      return { success: false, requiresAuth: true }
    }

    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity, size }),
      })

      if (res.ok) {
        await refreshCart()
        return { success: true }
      }
      return { success: false }
    } catch {
      return { success: false }
    }
  }

  const removeFromCart = async (productId: string, size?: string) => {
    try {
      await fetch('/api/cart/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, size }),
      })
      await refreshCart()
    } catch {
      console.error('Error removing from cart')
    }
  }

  const updateQuantity = async (productId: string, quantity: number, size?: string) => {
    try {
      await fetch('/api/cart/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity, size }),
      })
      await refreshCart()
    } catch {
      console.error('Error updating cart')
    }
  }

  const clearCart = async () => {
    try {
      await fetch('/api/cart/clear', { method: 'POST' })
      setItems([])
    } catch {
      console.error('Error clearing cart')
    }
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.product.price, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        loading,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshCart,
        totalItems,
        totalPrice,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
