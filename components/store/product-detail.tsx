// components/store/product-detail.tsx
'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import { ShoppingBag, Minus, Plus, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import { ProductCard } from './product-card'

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
  images: { id: string; url: string }[]
  category: { name: string; slug: string }
  sizes?: ProductSize[]
}

interface ProductDetailProps {
  product: Product
  relatedProducts: Product[]
}

const SIZES = ['S', 'M', 'L', 'XL'] as const

export function ProductDetail({ product, relatedProducts }: ProductDetailProps) {
  const router = useRouter()
  const { addToCart } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Verificar si el producto tiene tallas
  const hasSizes = product.sizes && product.sizes.length > 0

  // Obtener stock de la talla seleccionada
  const getSelectedSizeStock = () => {
    if (!hasSizes || !selectedSize) return product.stock
    const sizeData = product.sizes?.find((s) => s.size === selectedSize)
    return sizeData?.stock || 0
  }

  const selectedSizeStock = getSelectedSizeStock()

  const handleAddToCart = async () => {
    setError('')
    
    // Validar talla seleccionada si el producto tiene tallas
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

  // Navegacion del carrusel
  const nextImage = () => {
    setSelectedImage((prev) => (prev + 1) % product.images.length)
  }

  const prevImage = () => {
    setSelectedImage((prev) => (prev - 1 + product.images.length) % product.images.length)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <Link
        href="/productos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a productos
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images Carousel */}
        <div className="space-y-4">
          <div className="relative aspect-square bg-card rounded-lg overflow-hidden border border-border">
            {product.images[selectedImage] ? (
              <Image
                src={product.images[selectedImage].url}
                alt={product.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                <ShoppingBag className="w-20 h-20" />
              </div>
            )}

            {/* Carousel navigation */}
            {product.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm rounded-full border border-border hover:bg-background transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-background/80 backdrop-blur-sm rounded-full border border-border hover:bg-background transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Image indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {product.images.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`w-2 h-2 rounded-full transition-colors ${
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

          {/* Thumbnail images */}
          {product.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setSelectedImage(index)}
                  className={`relative aspect-square bg-card rounded-lg overflow-hidden border transition-colors ${
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

        {/* Info */}
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground uppercase tracking-wider mb-2">
              {product.category.name}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">{product.name}</h1>
          </div>

          <p className="text-3xl font-bold">${product.price.toFixed(2)} MXN</p>

          {product.description && (
            <p className="text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          )}

          {/* Size selector */}
          {hasSizes && (
            <div>
              <div className="flex items-center justify-between mb-3">
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
                      className={`w-14 h-14 rounded-lg border font-medium transition-all ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : isAvailable
                          ? 'border-border hover:border-primary/50 bg-card'
                          : 'border-border bg-muted text-muted-foreground opacity-50 cursor-not-allowed line-through'
                      }`}
                    >
                      {size}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quantity selector */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Cantidad:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-2 bg-secondary rounded-lg hover:bg-muted transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-12 text-center font-medium">{quantity}</span>
              <button
                onClick={() =>
                  setQuantity(Math.min(selectedSizeStock, quantity + 1))
                }
                disabled={quantity >= selectedSizeStock}
                className="p-2 bg-secondary rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {hasSizes ? (
              selectedSize ? (
                selectedSizeStock > 0 ? `${selectedSizeStock} disponibles en talla ${selectedSize}` : 'Talla agotada'
              ) : (
                'Selecciona una talla'
              )
            ) : (
              product.stock > 0 ? `${product.stock} disponibles` : 'Agotado'
            )}
          </p>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <button
            onClick={handleAddToCart}
            disabled={loading || selectedSizeStock === 0 || (hasSizes && !selectedSize)}
            className="w-full py-4 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-5 h-5" />
            {loading ? 'Agregando...' : 'Agregar al carrito'}
          </button>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="mt-20">
          <h2 className="text-2xl font-bold mb-8">Productos relacionados</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
