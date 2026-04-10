// components/admin/product-form.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Plus, X, Upload, ImageIcon, Loader2 } from 'lucide-react'

interface Category {
  id: string
  name: string
}

interface ProductImage {
  id: string
  url: string
  order: number
}

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
  status: string
  categoryId: string
  images: ProductImage[]
  sizes: ProductSize[]
}

interface ProductFormProps {
  product?: Product
  categories: Category[]
}

const SIZES = ['S', 'M', 'L', 'XL'] as const

export function ProductForm({ product, categories }: ProductFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState(product?.name || '')
  const [description, setDescription] = useState(product?.description || '')
  const [price, setPrice] = useState(product?.price?.toString() || '')
  const [categoryId, setCategoryId] = useState(product?.categoryId || '')
  const [status, setStatus] = useState(product?.status || 'ACTIVE')
  const [images, setImages] = useState<string[]>(
    product?.images.map((img) => img.url) || []
  )

  // Estado para tallas - inicializar con valores existentes o 0
  const [sizeStock, setSizeStock] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0 }
    if (product?.sizes) {
      product.sizes.forEach((s) => {
        initial[s.size] = s.stock
      })
    }
    return initial
  })

  // Calcular stock total basado en tallas
  const totalStock = Object.values(sizeStock).reduce((sum, val) => sum + val, 0)

  const handleSizeStockChange = (size: string, value: string) => {
    const numValue = parseInt(value) || 0
    setSizeStock((prev) => ({
      ...prev,
      [size]: Math.max(0, numValue),
    }))
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError('')

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al subir imagen')
        }

        const data = await res.json()
        return data.url
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setImages([...images, ...uploadedUrls])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagenes')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer.files
    if (!files || files.length === 0) return

    setUploading(true)
    setError('')

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validar tipo
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
        if (!validTypes.includes(file.type)) {
          throw new Error('Solo se permiten imagenes JPG, PNG, WEBP o GIF')
        }

        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Error al subir imagen')
        }

        const data = await res.json()
        return data.url
      })

      const uploadedUrls = await Promise.all(uploadPromises)
      setImages([...images, ...uploadedUrls])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagenes')
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const url = product
        ? `/api/admin/products/${product.id}`
        : '/api/admin/products'
      const method = product ? 'PUT' : 'POST'

      // Preparar datos de tallas
      const sizes = SIZES.map((size) => ({
        size,
        stock: sizeStock[size] || 0,
      }))

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          price: parseFloat(price),
          stock: totalStock,
          categoryId,
          status,
          images,
          sizes,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Error al guardar')
      }

      router.push('/admin/productos')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <Link
        href="/admin/productos"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a productos
      </Link>

      <div className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium mb-2">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-2">Descripcion</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium mb-2">Precio</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        {/* Tallas e Inventario */}
        <div className="bg-secondary/50 border border-border rounded-lg p-4">
          <label className="block text-sm font-medium mb-4">
            Inventario por Talla
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {SIZES.map((size) => (
              <div key={size} className="space-y-2">
                <label className="block text-xs text-muted-foreground text-center">
                  Talla {size}
                </label>
                <input
                  type="number"
                  min="0"
                  value={sizeStock[size]}
                  onChange={(e) => handleSizeStockChange(size, e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring text-center"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Stock Total:</span>
            <span className="text-lg font-bold">{totalStock} unidades</span>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-2">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            required
          >
            <option value="">Seleccionar categoria</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium mb-2">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-4 py-3 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ACTIVE">Activo</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>

        {/* Images Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">Imagenes (maximo 3 para carrusel)</label>
          
          {/* Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer
              transition-colors hover:border-primary/50 hover:bg-secondary/50
              ${uploading ? 'border-primary bg-secondary/50' : 'border-border'}
              ${images.length >= 3 ? 'opacity-50 pointer-events-none' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={images.length >= 3}
            />
            
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Subiendo imagenes...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {images.length >= 3 
                      ? 'Limite de imagenes alcanzado'
                      : 'Arrastra imagenes aqui o haz clic para seleccionar'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    JPG, PNG, WEBP o GIF - Maximo 5MB por imagen
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Recommended Dimensions */}
          <div className="mt-3 p-3 bg-secondary/50 rounded-lg border border-border">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Dimensiones recomendadas
            </p>
            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
              <li>Imagen principal: <span className="text-foreground font-medium">1200 x 1500 px</span> (ratio 4:5)</li>
              <li>Minimo recomendado: <span className="text-foreground font-medium">800 x 1000 px</span></li>
              <li>Formato cuadrado tambien funciona: <span className="text-foreground font-medium">1000 x 1000 px</span></li>
            </ul>
          </div>

          {/* Current images */}
          {images.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                {images.length} de 3 {images.length === 1 ? 'imagen' : 'imagenes'} (se mostraran en carrusel)
              </p>
              <div className="grid grid-cols-3 gap-3">
                {images.map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-[4/5] bg-card rounded-lg overflow-hidden border border-border group"
                  >
                    <Image
                      src={url}
                      alt={`Imagen ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 bg-background/80 text-foreground text-xs font-medium rounded">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage(index)
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={loading || uploading}
            className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? 'Guardando...'
              : product
              ? 'Guardar cambios'
              : 'Crear producto'}
          </button>
          <Link
            href="/admin/productos"
            className="px-6 py-3 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-muted transition-colors text-center"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  )
}
