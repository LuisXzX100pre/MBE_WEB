'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { upload } from '@vercel/blob/client'
import { ArrowLeft, X, Upload, ImageIcon, Loader2 } from 'lucide-react'

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
  dropName?: string | null
  releaseAt?: string | Date | null
  categoryId: string
  images: ProductImage[]
  sizes: ProductSize[]
}

interface ProductFormProps {
  product?: Product
  categories: Category[]
}

const SIZES = ['S', 'M', 'L', 'XL'] as const
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_SIZE = 10 * 1024 * 1024

function toDateTimeLocalValue(value?: string | Date | null) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const pad = (num: number) => String(num).padStart(2, '0')

  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours = pad(date.getHours())
  const minutes = pad(date.getMinutes())

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

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
  const [dropName, setDropName] = useState(product?.dropName || '')
  const [releaseAt, setReleaseAt] = useState(
    toDateTimeLocalValue(product?.releaseAt || null)
  )
  const [images, setImages] = useState<string[]>(
    product?.images.map((img) => img.url) || []
  )

  const [sizeStock, setSizeStock] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = { S: 0, M: 0, L: 0, XL: 0 }
    if (product?.sizes) {
      product.sizes.forEach((s) => {
        initial[s.size] = s.stock
      })
    }
    return initial
  })

  const totalStock = Object.values(sizeStock).reduce((sum, val) => sum + val, 0)

  const handleSizeStockChange = (size: string, value: string) => {
    const numValue = parseInt(value) || 0
    setSizeStock((prev) => ({
      ...prev,
      [size]: Math.max(0, numValue),
    }))
  }

  const validateFile = (file: File) => {
    if (!VALID_TYPES.includes(file.type)) {
      throw new Error('Solo se permiten imagenes JPG, PNG, WEBP o GIF')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error('Cada imagen debe pesar maximo 10MB')
    }
  }

  const uploadSingleFile = async (file: File) => {
    validateFile(file)

    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).slice(2, 8)
    const pathname = `products/product-${timestamp}-${randomStr}.${extension}`

    const blob = await upload(pathname, file, {
      access: 'public',
      handleUploadUrl: '/api/upload',
      clientPayload: JSON.stringify({
        mimeType: file.type,
        size: file.size,
      }),
    })

    return blob.url
  }

  const uploadFiles = async (files: FileList | File[]) => {
    const incomingFiles = Array.from(files)

    if (images.length + incomingFiles.length > 3) {
      throw new Error('Solo puedes subir maximo 3 imagenes')
    }

    setUploading(true)
    setError('')

    try {
      const uploadedUrls = await Promise.all(
        incomingFiles.map((file) => uploadSingleFile(file))
      )

      setImages((prev) => [...prev, ...uploadedUrls])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir imagenes')
    } finally {
      setUploading(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    await uploadFiles(files)
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

    await uploadFiles(files)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (status === 'COMING_SOON' && !releaseAt) {
        throw new Error('Debes elegir una fecha de lanzamiento para el drop')
      }

      const url = product
        ? `/api/admin/products/${product.id}`
        : '/api/admin/products'
      const method = product ? 'PUT' : 'POST'

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
          dropName: dropName || null,
          releaseAt: releaseAt ? new Date(releaseAt).toISOString() : null,
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
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver a productos
      </Link>

      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium">Nombre</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Descripcion</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-border bg-secondary px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Precio</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
            required
          />
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <label className="mb-4 block text-sm font-medium">
            Inventario por Talla
          </label>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SIZES.map((size) => (
              <div key={size} className="space-y-2">
                <label className="block text-center text-xs text-muted-foreground">
                  Talla {size}
                </label>
                <input
                  type="number"
                  min="0"
                  value={sizeStock[size]}
                  onChange={(e) => handleSizeStockChange(size, e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-center focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Stock Total:</span>
            <span className="text-lg font-bold">{totalStock} unidades</span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Categoria</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
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

        <div>
          <label className="mb-2 block text-sm font-medium">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="ACTIVE">Activo</option>
            <option value="COMING_SOON">Proximo drop</option>
            <option value="INACTIVE">Inactivo</option>
          </select>
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <h3 className="mb-4 text-sm font-medium">Configuracion de Drop</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Nombre del drop
              </label>
              <input
                type="text"
                value={dropName}
                onChange={(e) => setDropName(e.target.value)}
                placeholder="Ej. DROP 1 / SUMMER DROP / CAPSULE 02"
                className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Fecha y hora de lanzamiento
              </label>
              <input
                type="datetime-local"
                value={releaseAt}
                onChange={(e) => setReleaseAt(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Si el producto esta en "Proximo drop", esta fecha se usa para
                desbloquearlo automaticamente.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Imagenes (maximo 3 para carrusel)
          </label>

          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:border-primary/50 hover:bg-secondary/50 sm:p-8
              ${uploading ? 'border-primary bg-secondary/50' : 'border-border'}
              ${images.length >= 3 ? 'pointer-events-none opacity-50' : ''}
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
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Subiendo imagenes...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {images.length >= 3
                      ? 'Limite de imagenes alcanzado'
                      : 'Arrastra imagenes aqui o haz clic para seleccionar'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG, WEBP o GIF - Maximo 10MB por imagen
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 rounded-lg border border-border bg-secondary/50 p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
              Dimensiones recomendadas
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>
                Imagen principal:{' '}
                <span className="font-medium text-foreground">
                  1200 x 1500 px
                </span>{' '}
                (ratio 4:5)
              </li>
              <li>
                Minimo recomendado:{' '}
                <span className="font-medium text-foreground">800 x 1000 px</span>
              </li>
              <li>
                Formato cuadrado tambien funciona:{' '}
                <span className="font-medium text-foreground">1000 x 1000 px</span>
              </li>
            </ul>
          </div>

          {images.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm text-muted-foreground">
                {images.length} de 3{' '}
                {images.length === 1 ? 'imagen' : 'imagenes'} (se mostraran en
                carrusel)
              </p>

              <div className="grid grid-cols-3 gap-3">
                {images.map((url, index) => (
                  <div
                    key={index}
                    className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border bg-card"
                  >
                    <Image
                      src={url}
                      alt={`Imagen ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                    <span className="absolute left-2 top-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium text-foreground">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveImage(index)
                      }}
                      className="absolute right-2 top-2 rounded-full bg-destructive p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={loading || uploading}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading
              ? 'Guardando...'
              : product
                ? 'Guardar cambios'
                : 'Crear producto'}
          </button>

          <Link
            href="/admin/productos"
            className="rounded-lg bg-secondary px-6 py-3 text-center font-medium text-secondary-foreground transition-colors hover:bg-muted"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  )
}