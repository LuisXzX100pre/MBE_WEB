'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import { ShoppingBag, Plus, Lock } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  status: 'ACTIVE' | 'COMING_SOON' | 'INACTIVE'
  dropName?: string | null
  releaseAt?: string | Date | null
  images: { url: string }[]
  category: { name: string; slug: string }
}

interface ProductCardProps {
  product: Product
}

function formatReleaseDate(value?: string | Date | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isLockedDrop(product: Product) {
  if (product.status !== 'COMING_SOON') return false
  if (!product.releaseAt) return true

  const releaseDate = new Date(product.releaseAt)
  if (Number.isNaN(releaseDate.getTime())) return true

  return releaseDate.getTime() > Date.now()
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const { addToCart } = useCart()
  const [loading, setLoading] = useState(false)

  const lockedDrop = isLockedDrop(product)
  const releaseLabel = formatReleaseDate(product.releaseAt)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (lockedDrop) {
      return
    }

    setLoading(true)

    const result = await addToCart(product.id)

    setLoading(false)

    if (result.requiresAuth) {
      router.push('/login')
    }
  }

  return (
    <Link href={`/productos/${product.id}`} className="group">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg border border-border bg-card">
        {product.images[0] ? (
          <Image
            src={product.images[0].url}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-12 w-12" />
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {product.dropName && (
            <span className="rounded-full bg-black/70 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
              {product.dropName}
            </span>
          )}

          {lockedDrop && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black">
              <Lock className="h-3 w-3" />
              Proximo drop
            </span>
          )}
        </div>

        {lockedDrop ? (
          <div className="absolute inset-x-3 bottom-3 rounded-2xl border border-white/10 bg-black/70 px-3 py-3 backdrop-blur-md">
            <p className="text-xs font-semibold text-white">
              Disponible al terminar el countdown
            </p>
            {releaseLabel && (
              <p className="mt-1 text-[11px] text-white/65">
                Sale: {releaseLabel}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={handleAddToCart}
            disabled={loading}
            className="absolute bottom-4 right-4 rounded-full bg-primary p-3 text-primary-foreground opacity-0 transition-opacity hover:scale-110 group-hover:opacity-100 disabled:opacity-50"
          >
            <Plus className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {product.category.name}
        </p>

        <h3 className="text-sm font-medium transition-colors group-hover:text-muted-foreground">
          {product.name}
        </h3>

        <p className="font-bold">${product.price.toFixed(2)} MXN</p>

        {lockedDrop && (
          <p className="text-xs font-medium text-amber-400">
            Visible, pero aun no disponible para comprar
          </p>
        )}
      </div>
    </Link>
  )
}