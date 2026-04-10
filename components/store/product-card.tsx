// components/store/product-card.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import { ShoppingBag, Plus } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  images: { url: string }[]
  category: { name: string; slug: string }
}

interface ProductCardProps {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const { addToCart } = useCart()
  const [loading, setLoading] = useState(false)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setLoading(true)

    const result = await addToCart(product.id)

    setLoading(false)

    if (result.requiresAuth) {
      router.push('/login')
    }
  }

  return (
    <Link href={`/productos/${product.id}`} className="group">
      <div className="relative aspect-[3/4] bg-card rounded-lg overflow-hidden border border-border">
        {product.images[0] ? (
          <Image
            src={product.images[0].url}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ShoppingBag className="w-12 h-12" />
          </div>
        )}

        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

        {/* Add to cart button */}
        <button
          onClick={handleAddToCart}
          disabled={loading}
          className="absolute bottom-4 right-4 p-3 bg-primary text-primary-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          {product.category.name}
        </p>
        <h3 className="font-medium text-sm group-hover:text-muted-foreground transition-colors">
          {product.name}
        </h3>
        <p className="font-bold">${product.price.toFixed(2)} MXN</p>
      </div>
    </Link>
  )
}
