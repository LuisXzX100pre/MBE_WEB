// components/admin/categories-manager.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Tags, X, Check } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  _count: { products: number }
}

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setName('')
    setError('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      resetForm()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (id: string) => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      resetForm()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Estas seguro? Los productos de esta categoria quedaran sin categoria.')) return

    try {
      const res = await fetch(`/api/admin/categories/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error deleting category:', error)
    }
  }

  const startEdit = (category: Category) => {
    setEditingId(category.id)
    setName(category.name)
    setShowForm(false)
  }

  return (
    <div className="max-w-2xl">
      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => {
            setShowForm(true)
            setEditingId(null)
            setName('')
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity mb-6"
        >
          <Plus className="w-5 h-5" />
          Nueva categoria
        </button>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-card p-4 rounded-lg border border-border mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la categoria"
              className="flex-1 px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-secondary rounded-lg hover:bg-muted"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </form>
      )}

      {/* Categories list */}
      {categories.length > 0 ? (
        <div className="bg-card rounded-lg border border-border divide-y divide-border">
          {categories.map((category) => (
            <div key={category.id} className="p-4 flex items-center justify-between">
              {editingId === category.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    onClick={() => handleUpdate(category.id)}
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 bg-secondary rounded-lg hover:bg-muted"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {category._count.products} productos
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(category)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-lg border border-border p-12 text-center">
          <Tags className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No hay categorias aun</p>
        </div>
      )}
    </div>
  )
}
