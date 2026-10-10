'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Tags, Loader2 } from 'lucide-react'

interface Category {
  id: string
  name: string
  slug: string
  _count: { products: number }
}

export function CategoriesManager({ categories: initialCategories }: { categories: Category[] }) {
  const router = useRouter()
  const [categories, setCategories] = useState(initialCategories)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  const resetForm = () => {
    setShowForm(false); setEditingId(null); setName(''); setError('')
  }

  async function categoryRequest(url: string, method: string, data?: { name: string }) {
    const response = await fetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      ...(data ? { body: JSON.stringify(data) } : {}),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok) throw new Error(result?.error || 'No se pudo guardar la categoría.')
    return result
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    submitting.current = true; setLoading(true); setError('')
    try {
      const { category } = await categoryRequest('/api/admin/categories' + (editingId ? '/' + editingId : ''), editingId ? 'PATCH' : 'POST', { name })
      setCategories(previous => [...previous.filter(item => item.id !== category.id), category]
        .sort((a, b) => a.name.localeCompare(b.name, 'es')))
      resetForm(); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo guardar la categoría.') }
    finally { submitting.current = false; setLoading(false) }
  }

  async function remove(category: Category) {
    if (submitting.current || !window.confirm('¿Eliminar la categoría "' + category.name + '"? Solo se permite si no tiene productos asociados.')) return
    submitting.current = true; setLoading(true); setError('')
    try {
      await categoryRequest('/api/admin/categories/' + category.id, 'DELETE')
      setCategories(previous => previous.filter(item => item.id !== category.id))
      if (editingId === category.id) resetForm()
      router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo eliminar la categoría.') }
    finally { submitting.current = false; setLoading(false) }
  }

  return <div className="max-w-2xl space-y-6" aria-busy={loading}>
    {!showForm && <button disabled={loading} onClick={() => { resetForm(); setShowForm(true) }}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 disabled:opacity-50">
      <Plus className="h-5 w-5" />Crear categoría
    </button>}
    {showForm && <form onSubmit={save} className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h2 className="font-semibold">{editingId ? 'Editar categoría' : 'Crear categoría'}</h2>
      <label htmlFor="category-name" className="block text-sm font-medium">Nombre</label>
      <input id="category-name" value={name} onChange={event => setName(event.target.value)} required maxLength={80} disabled={loading}
        className="w-full rounded-lg border border-border bg-secondary px-4 py-2 focus:outline-none focus:ring-2 focus:ring-ring" />
      <p className="text-sm text-muted-foreground">El slug se genera automáticamente a partir del nombre.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Guardando...' : 'Guardar categoría'}
        </button>
        <button type="button" disabled={loading} onClick={resetForm} className="rounded-lg bg-secondary px-4 py-2 disabled:opacity-50">Cancelar</button>
      </div>
    </form>}
    {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {loading && <p role="status" className="text-sm text-muted-foreground">Procesando categoría...</p>}
    {categories.length > 0 ? <div className="divide-y divide-border rounded-lg border border-border bg-card">
      {categories.map(category => <div key={category.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="break-words font-medium">{category.name}</p>
          <p className="break-all text-sm text-muted-foreground">{category.slug}</p>
          <p className="text-sm text-muted-foreground">{category._count.products} {category._count.products === 1 ? 'producto' : 'productos'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button disabled={loading} onClick={() => { setEditingId(category.id); setName(category.name); setShowForm(true); setError('') }}
            aria-label={'Editar ' + category.name} className="inline-flex items-center gap-2 rounded-lg p-2 hover:bg-secondary disabled:opacity-50">
            <Pencil className="h-4 w-4" />Editar
          </button>
          <button disabled={loading} onClick={() => remove(category)} aria-label={'Eliminar ' + category.name}
            className="inline-flex items-center gap-2 rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />Eliminar
          </button>
        </div>
      </div>)}
    </div> : <div className="rounded-lg border border-border bg-card p-8 text-center">
      <Tags className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
      <p className="font-medium">No hay categorías todavía.</p>
      <p className="mt-2 text-sm text-muted-foreground">Créala aquí para poder registrar productos.</p>
    </div>}
  </div>
}
