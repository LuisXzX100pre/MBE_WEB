'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import { ShoppingBag, Plus, Lock } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  stock?: number
  status: 'ACTIVE' | 'COMING_SOON' | 'INACTIVE'
  dropName?: string | null
  releaseAt?: string | Date | null
  images: { url: string }[]
  category: { name: string; slug: string }
  sizes?: {
    id: string
    size: 'S' | 'M' | 'L' | 'XL'
    stock: number
  }[]
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

function getTotalStock(product: Product) {
  if (product.sizes && product.sizes.length > 0) {
    return product.sizes.reduce((acc, size) => acc + size.stock, 0)
  }

  return product.stock ?? 0
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter()
  const { addToCart } = useCart()
  const [loading, setLoading] = useState(false)

  const lockedDrop = isLockedDrop(product)
  const releaseLabel = formatReleaseDate(product.releaseAt)
  const totalStock = useMemo(() => getTotalStock(product), [product])
  const isSoldOut = totalStock <= 0
  const showLockedState = lockedDrop && !isSoldOut

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (lockedDrop || isSoldOut) {
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
    <Link href={`/productos/${product.id}`} className="group block">
      <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-card shadow-[0_14px_50px_rgba(0,0,0,0.18)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_20px_70px_rgba(0,0,0,0.26)]">
        <div className="relative aspect-[3/4] overflow-hidden">
          {product.images[0] ? (
            <Image
              src={product.images[0].url}
              alt={product.name}
              fill
              className={`object-cover transition-transform duration-500 group-hover:scale-[1.04] ${
                isSoldOut ? 'grayscale' : ''
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ShoppingBag className="h-12 w-12" />
            </div>
          )}

          <div
            className={`absolute inset-0 transition-all duration-300 ${
              isSoldOut
                ? 'bg-black/35'
                : 'bg-gradient-to-t from-black/45 via-black/0 to-black/10 group-hover:from-black/55'
            }`}
          />

          <div className="absolute left-3 top-3 z-20 flex max-w-[80%] flex-col gap-2">
            {product.dropName && (
              <span className="w-fit rounded-full border border-red-500/25 bg-red-600 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white shadow-[0_10px_30px_rgba(220,38,38,0.30)]">
                {product.dropName}
              </span>
            )}

            {showLockedState && (
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black shadow-[0_10px_30px_rgba(251,191,36,0.20)]">
                <Lock className="h-3 w-3" />
                Próximo drop
              </span>
            )}

            {isSoldOut && (
              <span className="w-fit rounded-full border border-white/10 bg-zinc-900/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-white">
                Sold Out
              </span>
            )}
          </div>

          {isSoldOut ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center">
              <div className="rounded-full border border-white/10 bg-black/60 px-5 py-2.5 backdrop-blur-md shadow-2xl">
                <span className="text-[11px] font-semibold uppercase tracking-[0.38em] text-white/95">
                  Sold Out
                </span>
              </div>
            </div>
          ) : showLockedState ? (
            <div className="absolute inset-x-3 bottom-3 z-20 rounded-[1.25rem] border border-white/10 bg-black/65 px-4 py-3.5 backdrop-blur-md">
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
              aria-label={`Agregar ${product.name} al carrito`}
              className="absolute bottom-4 right-4 z-20 rounded-full border border-white/10 bg-white p-3 text-black opacity-0 shadow-xl transition-all duration-300 hover:scale-110 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="space-y-2 px-4 pb-4 pt-3">
          <p className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            {product.category.name}
          </p>

          <h3 className="line-clamp-2 text-sm font-semibold leading-6 transition-colors group-hover:text-foreground/80">
            {product.name}
          </h3>

          <div className="flex items-end justify-between gap-3">
            <p className="text-base font-black tracking-tight">
              ${product.price.toFixed(2)} MXN
            </p>

            {!showLockedState && !isSoldOut && (
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                Disponible
              </span>
            )}
          </div>

          {showLockedState && (
            <p className="text-xs font-medium text-amber-400">
              Visible, pero aún no disponible para comprar
            </p>
          )}

          {isSoldOut && (
            <p className="text-xs font-medium text-zinc-400">
              Agotado por el momento
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}