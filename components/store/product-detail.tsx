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

  const handleAddToCart = async () => {
    setError('')

    if (dropState.locked) {
      setError('Este producto se habilita cuando termine el contador.')
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

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Link
        href="/productos"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a productos
      </Link>

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-border bg-card">
            {product.images[selectedImage] ? (
              <Image
                src={product.images[selectedImage].url}
                alt={product.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ShoppingBag className="h-20 w-20" />
              </div>
            )}

            {product.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-border bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-background"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                  {product.images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`h-2 w-2 rounded-full transition-colors ${
                        selectedImage === index
                          ? 'bg-primary'
                          : 'bg-background/60 hover:bg-background'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImage(index)}
                  className={`relative aspect-square overflow-hidden rounded-lg border transition-colors ${
                    selectedImage === index
                      ? 'border-primary'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <Image
                    src={image.url}
                    alt={`${product.name} ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm uppercase tracking-wider text-muted-foreground">
              {product.category.name}
            </p>

            {product.dropName && (
              <div className="mb-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-white">
                {product.dropName}
              </div>
            )}

            <h1 className="text-3xl font-bold md:text-4xl">{product.name}</h1>
          </div>

          <p className="text-3xl font-bold">${product.price.toFixed(2)} MXN</p>

          {product.description && (
            <p className="leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          )}

          {dropState.locked && product.releaseAt && (
            <div className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="mb-4 flex items-center gap-2 text-amber-300">
                <Lock className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  Proximo drop bloqueado hasta la fecha de lanzamiento
                </span>
              </div>

              <DropCountdown
                targetDate={new Date(product.releaseAt).toISOString()}
                title={product.dropName || product.name}
                subtitle={
                  releaseLabel
                    ? `Este producto se habilita el ${releaseLabel}. Puedes ver tallas y detalle, pero aun no comprar.`
                    : 'Este producto aun no esta disponible para compra.'
                }
              />
            </div>
          )}

          {dropState.released && product.status === 'COMING_SOON' && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm font-medium text-emerald-300">
                Este drop ya se encuentra disponible para compra.
              </p>
            </div>
          )}

          {hasSizes && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Talla:</span>
                {selectedSize && (
                  <span className="text-sm text-muted-foreground">
                    {selectedSizeStock} disponibles
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {SIZES.map((size) => {
                  const sizeData = product.sizes?.find((s) => s.size === size)
                  const isAvailable = sizeData && sizeData.stock > 0
                  const isSelected = selectedSize === size

                  return (
                    <button
                      key={size}
                      onClick={() => isAvailable && setSelectedSize(size)}
                      disabled={!isAvailable}
                      className={`h-14 w-14 rounded-lg border font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isAvailable
                            ? 'border-border bg-card hover:border-primary/50'
                            : 'cursor-not-allowed border-border bg-muted text-muted-foreground opacity-50 line-through'
                      }`}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Cantidad:</span>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={dropState.locked}
                className="rounded-lg bg-secondary p-2 transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Minus className="h-4 w-4" />
              </button>

              <span className="w-12 text-center font-medium">{quantity}</span>

              <button
                onClick={() =>
                  setQuantity(Math.min(selectedSizeStock, quantity + 1))
                }
                disabled={dropState.locked || quantity >= selectedSizeStock}
                className="rounded-lg bg-secondary p-2 transition-colors hover:bg-muted disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {hasSizes ? (
              selectedSize ? (
                selectedSizeStock > 0
                  ? `${selectedSizeStock} disponibles en talla ${selectedSize}`
                  : 'Talla agotada'
              ) : (
                'Selecciona una talla'
              )
            ) : product.stock > 0 ? (
              `${product.stock} disponibles`
            ) : (
              'Agotado'
            )}
          </p>

          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={
              loading ||
              dropState.locked ||
              selectedSizeStock === 0 ||
              (hasSizes && !selectedSize)
            }
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <ShoppingBag className="h-5 w-5" />
            {loading
              ? 'Agregando...'
              : dropState.locked
                ? 'Disponible cuando termine el contador'
                : 'Agregar al carrito'}
          </button>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-8 text-2xl font-bold">Productos relacionados</h2>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
