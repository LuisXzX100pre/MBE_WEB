'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import {
  ShoppingBag,
  Minus,
  Plus,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
} from 'lucide-react'
import { ProductCard } from './product-card'
import { DropCountdown } from './drop-countdown'

interface ProductSize {
  id: string
  size: 'S' | 'M' | 'L' | 'XL'
  stock: number
}

interface Product {
  id: string
  name: string
  description: string | null
  price: number
  stock: number
  status: 'ACTIVE' | 'COMING_SOON' | 'INACTIVE'
  dropName?: string | null
  releaseAt?: string | Date | null
  images: { id: string; url: string }[]
  category: { name: string; slug: string }
  sizes?: ProductSize[]
}

interface ProductDetailProps {
  product: Product
  relatedProducts: Product[]
}

const SIZES = ['S', 'M', 'L', 'XL'] as const

function formatReleaseDate(value?: string | Date | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getDropState(product: Product) {
  if (product.status !== 'COMING_SOON') {
    return {
      locked: false,
      released: false,
    }
  }

  if (!product.releaseAt) {
    return {
      locked: true,
      released: false,
    }
  }

  const releaseDate = new Date(product.releaseAt)
  if (Number.isNaN(releaseDate.getTime())) {
    return {
      locked: true,
      released: false,
    }
  }

  if (releaseDate.getTime() > Date.now()) {
    return {
      locked: true,
      released: false,
    }
  }

  return {
    locked: false,
    released: true,
  }
}

export function ProductDetail({ product, relatedProducts }: ProductDetailProps) {
  const router = useRouter()
  const { addToCart } = useCart()

  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const hasSizes = product.sizes && product.sizes.length > 0
  const dropState = useMemo(() => getDropState(product), [product])
  const releaseLabel = formatReleaseDate(product.releaseAt)

  const getSelectedSizeStock = () => {
    if (!hasSizes || !selectedSize) return product.stock
    const sizeData = product.sizes?.find((s) => s.size === selectedSize)
    return sizeData?.stock || 0
  }

  const selectedSizeStock = getSelectedSizeStock()

  const totalAvailableStock = useMemo(() => {
    if (hasSizes) {
      return product.sizes?.reduce((acc, size) => acc + size.stock, 0) || 0
    }

    return product.stock
  }, [hasSizes, product.sizes, product.stock])

  const isSoldOut = totalAvailableStock <= 0
  const canPurchase =
    !dropState.locked &&
    !isSoldOut &&
    (!hasSizes || (hasSizes && !!selectedSize && selectedSizeStock > 0))

  const handleAddToCart = async () => {
    setError('')

    if (dropState.locked) {
      setError('Este producto se habilita cuando termine el contador.')
      return
    }

    if (isSoldOut) {
      setError('Este producto está agotado por ahora.')
      return
    }

    if (hasSizes && !selectedSize) {
      setError('Por favor selecciona una talla')
      return
    }

    setLoading(true)
    const result = await addToCart(product.id, quantity, selectedSize || undefined)
    setLoading(false)

    if (result.requiresAuth) {
      router.push('/login')
    }
  }

  const nextImage = () => {
    setSelectedImage((prev) => (prev + 1) % product.images.length)
  }

  const prevImage = () => {
    setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length)
  }

  const maxQuantity = hasSizes ? selectedSizeStock : product.stock

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Link
        href="/productos"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a productos
      </Link>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.06fr_0.94fr] xl:gap-12">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-card shadow-[0_20px_80px_rgba(0,0,0,0.28)]">
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-black/10" />

            <div className="relative aspect-[4/4.55] sm:aspect-square">
              {product.images[selectedImage] ? (
                <>
                  <Image
                    src={product.images[selectedImage].url}
                    alt={product.name}
                    fill
                    className={`object-cover transition duration-500 ${
                      isSoldOut ? 'scale-[1.02] grayscale' : ''
                    }`}
                    priority
                  />

                  {isSoldOut && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
                      <div className="rounded-full border border-white/15 bg-black/55 px-6 py-3 text-center shadow-2xl">
                        <span className="text-sm font-semibold uppercase tracking-[0.45em] text-white/90">
                          Sold Out
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <ShoppingBag className="h-20 w-20" />
                </div>
              )}

              <div className="absolute left-4 top-4 z-20 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85 backdrop-blur-md">
                  {product.category.name}
                </span>

                {product.dropName && (
                  <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-white shadow-[0_10px_30px_rgba(255,255,255,0.06)]">
                    {product.dropName}
                  </span>
                )}

                {isSoldOut && (
                  <span className="rounded-full border border-white/10 bg-zinc-900/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.28em] text-white">
                    Agotado
                  </span>
                )}
              </div>

              {product.images.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-2.5 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-black/70"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <button
                    onClick={nextImage}
                    className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/15 bg-black/45 p-2.5 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-black/70"
                    aria-label="Siguiente imagen"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>

                  <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 backdrop-blur-md">
                    {product.images.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        aria-label={`Ver imagen ${index + 1}`}
                        className={`h-2.5 w-2.5 rounded-full transition-all ${
                          selectedImage === index
                            ? 'w-6 bg-white'
                            : 'bg-white/45 hover:bg-white/80'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-3">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImage(index)}
                  className={`group relative aspect-square overflow-hidden rounded-2xl border transition-all ${
                    selectedImage === index
                      ? 'border-white/70 ring-1 ring-white/20'
                      : 'border-border/60 hover:border-white/30'
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={`${product.name} ${index + 1}`}
                    fill
                    className={`object-cover transition duration-300 group-hover:scale-[1.03] ${
                      isSoldOut ? 'grayscale' : ''
                    }`}
                  />
                  <div className="absolute inset-0 bg-black/10 transition-opacity group-hover:bg-black/0" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-card shadow-[0_20px_80px_rgba(0,0,0,0.22)]">
            <div className="border-b border-white/10 bg-gradient-to-br from-white/[0.045] to-transparent px-5 py-5 sm:px-7 sm:py-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {product.category.name}
                </span>

                {product.dropName && (
                  <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white shadow-[0_10px_30px_rgba(255,255,255,0.06)]">
                    {product.dropName}
                  </span>
                )}

                {dropState.locked && (
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
                    Próximamente
                  </span>
                )}

                {isSoldOut && (
                  <span className="rounded-full border border-white/10 bg-zinc-800 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/90">
                    Sold Out
                  </span>
                )}
              </div>

              <h1 className="text-3xl font-bold leading-tight md:text-4xl">
                {product.name}
              </h1>

              <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
                <p className="text-3xl font-black tracking-tight md:text-4xl">
                  ${product.price.toFixed(2)} MXN
                </p>

                {!dropState.locked && !isSoldOut && (
                  <span className="text-sm text-muted-foreground">
                    Listo para comprar
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
              {product.description && (
                <p className="text-[15px] leading-7 text-muted-foreground">
                  {product.description}
                </p>
              )}

              {dropState.locked && product.releaseAt && (
                <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent">
                  <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                    <div className="flex items-center gap-2 text-white/75">
                      <Lock className="h-4 w-4" />
                      <span className="text-sm font-semibold uppercase tracking-[0.18em]">
                        Drop bloqueado
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Puedes revisar imágenes, tallas y detalles, pero la compra se habilita cuando termine el contador.
                    </p>
                  </div>

                  <div className="px-4 py-4 sm:px-5">
                    <DropCountdown
                      targetDate={new Date(product.releaseAt).toISOString()}
                      title={product.dropName || product.name}
                      subtitle={
                        releaseLabel
                          ? `Disponible el ${releaseLabel}.`
                          : 'Este producto aún no está disponible para compra.'
                      }
                      variant="product"
                    />
                  </div>
                </div>
              )}

              {dropState.released && product.status === 'COMING_SOON' && !isSoldOut && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-emerald-300">
                    Este drop ya se encuentra disponible para compra.
                  </p>
                </div>
              )}

              {isSoldOut && (
                <div className="rounded-2xl border border-zinc-500/20 bg-zinc-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-zinc-300">
                    Este producto está agotado por ahora.
                  </p>
                </div>
              )}

              {hasSizes && (
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground/90">
                      Talla
                    </span>

                    {selectedSize ? (
                      <span className="text-sm text-muted-foreground">
                        {selectedSizeStock > 0
                          ? `${selectedSizeStock} disponibles`
                          : 'Sin stock'}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Selecciona una talla
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {SIZES.map((size) => {
                      const sizeData = product.sizes?.find((s) => s.size === size)
                      const isAvailable = sizeData && sizeData.stock > 0
                      const isSelected = selectedSize === size

                      return (
                        <button
                          key={size}
                          onClick={() => isAvailable && setSelectedSize(size)}
                          disabled={!isAvailable || dropState.locked || isSoldOut}
                          className={`h-14 rounded-2xl border text-sm font-semibold transition-all ${
                            isSelected
                              ? 'border-white bg-white text-black shadow-lg'
                              : isAvailable
                                ? 'border-white/10 bg-white/[0.035] text-foreground hover:border-white/30 hover:bg-white/[0.06]'
                                : 'cursor-not-allowed border-white/5 bg-muted/50 text-muted-foreground opacity-50 line-through'
                          }`}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground/90">
                      Cantidad
                    </span>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajusta cuántas piezas quieres agregar.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={dropState.locked || isSoldOut}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Disminuir cantidad"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <span className="inline-flex min-w-[56px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-center font-semibold">
                      {quantity}
                    </span>

                    <button
                      onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                      disabled={dropState.locked || isSoldOut || quantity >= maxQuantity}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 transition-all hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Aumentar cantidad"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.025] px-4 py-4 sm:px-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  {hasSizes ? (
                    selectedSize ? (
                      selectedSizeStock > 0
                        ? `${selectedSizeStock} disponibles en talla ${selectedSize}`
                        : `La talla ${selectedSize} está agotada`
                    ) : (
                      `Disponibilidad total: ${totalAvailableStock}`
                    )
                  ) : product.stock > 0 ? (
                    `${product.stock} disponibles`
                  ) : (
                    'Agotado'
                  )}
                </p>
              </div>

              {error && (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <button
                onClick={handleAddToCart}
                disabled={loading || !canPurchase}
                className={`flex w-full items-center justify-center gap-2 rounded-[1.4rem] py-4 font-semibold transition-all ${
                  canPurchase
                    ? 'bg-primary text-primary-foreground shadow-[0_20px_40px_rgba(255,255,255,0.08)] hover:translate-y-[-1px] hover:opacity-95'
                    : 'cursor-not-allowed bg-primary/50 text-primary-foreground/80 opacity-70'
                }`}
              >
                <ShoppingBag className="h-5 w-5" />
                {loading
                  ? 'Agregando...'
                  : dropState.locked
                    ? 'Disponible cuando termine el contador'
                    : isSoldOut
                      ? 'Producto agotado'
                      : hasSizes && !selectedSize
                        ? 'Selecciona una talla'
                        : 'Agregar al carrito'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.22em] text-muted-foreground">
                Sigue explorando
              </p>
              <h2 className="text-2xl font-bold md:text-3xl">
                Productos relacionados
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}