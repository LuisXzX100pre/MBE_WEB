'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Package } from 'lucide-react'

interface Product {
  id: string
  name: string
  price: number
  stock: number
  status: string
  category: { name: string }
  images: { url: string }[]
}

const statusMap: Record<
  string,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: 'Activo',
    className: 'bg-green-500/20 text-green-500',
  },
  COMING_SOON: {
    label: 'Proximo drop',
    className: 'bg-amber-500/20 text-amber-400',
  },
  INACTIVE: {
    label: 'Inactivo',
    className: 'bg-red-500/20 text-red-500',
  },
}

export function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Estas seguro de eliminar este producto?')) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting product:', error)
    } finally {
      setDeleting(null)
    }
  }

  if (products.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No hay productos aun</p>
        <Link
          href="/admin/productos/nuevo"
          className="inline-block mt-4 text-sm text-primary hover:underline"
        >
          Crear primer producto
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="text-left text-sm text-muted-foreground border-b border-border">
            <th className="p-4">Producto</th>
            <th className="p-4">Categoria</th>
            <th className="p-4">Precio</th>
            <th className="p-4">Stock</th>
            <th className="p-4">Estado</th>
            <th className="p-4">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const statusInfo =
              statusMap[product.status] || statusMap.INACTIVE

            return (
              <tr key={product.id} className="border-b border-border last:border-0">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 bg-secondary rounded-lg overflow-hidden flex-shrink-0">
                      {product.images[0] ? (
                        <Image
                          src={product.images[0].url}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <span className="font-medium">{product.name}</span>
                  </div>
                </td>

                <td className="p-4 text-sm text-muted-foreground">
                  {product.category.name}
                </td>

                <td className="p-4">${product.price.toFixed(2)}</td>
                <td className="p-4">{product.stock}</td>

                <td className="p-4">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${statusInfo.className}`}
                  >
                    {statusInfo.label}
                  </span>
                </td>

                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/productos/${product.id}`}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>

                    <button
                      onClick={() => handleDelete(product.id)}
                      disabled={deleting === product.id}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}