'use client'

import Image from 'next/image'
import { PRODUCT_SIZES, type ColorVariant } from '@/lib/product-variants'
export type ColorDraft = Omit<ColorVariant, 'id' | 'images'> & { id?: string; clientId: string; images: string[] }
type Props = {
  colors: ColorDraft[]; onChange: (colors: ColorDraft[]) => void
  homeImage: string; onHomeChange: (url: string) => void
  uploadFile: (file: File) => Promise<string>; busy: boolean
  onBusy: (busy: boolean) => void; onError: (error: string) => void
}
export function ProductVariantFields({ colors, onChange, homeImage, onHomeChange, uploadFile, busy, onBusy, onError }: Props) {
  const update = (index: number, patch: Partial<ColorDraft>) => onChange(colors.map((color, i) => i === index ? { ...color, ...patch } : color))
  async function upload(event: React.ChangeEvent<HTMLInputElement>, index?: number) {
    const input = event.currentTarget, files = Array.from(input.files || [])
    if (!files.length || busy) return
    onError('')
    const max = index === undefined ? 1 : 3 - colors[index].images.length
    if (files.length > max) { onError(`Puedes subir ${max} imagen(es) más`); input.value = ''; return }
    if (files.some(file => !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024)) {
      onError('Usa JPG, PNG, WEBP o GIF de máximo 10 MB por imagen'); input.value = ''; return
    }
    onBusy(true)
    try {
      const urls = await Promise.all(files.map(uploadFile))
      if (index === undefined) onHomeChange(urls[0])
      else update(index, { images: [...colors[index].images, ...urls] })
    } catch (error) { onError(error instanceof Error ? error.message : 'Error al subir imagen') }
    finally { onBusy(false); input.value = '' }
  }
  return <>
    <section className="space-y-4 rounded-xl border border-border p-4" aria-label="Variantes de color">
      <h2 className="font-semibold">Variantes de color</h2>
      <p className="text-xs text-muted-foreground">Cada color tiene imágenes y stock propios. Desactivar conserva historial e inventario.</p>
      {colors.map((color, index) => <fieldset key={color.clientId} disabled={busy} className="space-y-3 rounded-xl border border-border bg-secondary/30 p-3">
        <legend className="px-2 text-sm">{color.name || `Color ${index + 1}`}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs">Nombre<input required value={color.name} maxLength={80} onChange={event => update(index, { name: event.target.value })} className="mt-1 w-full rounded border border-border bg-background p-2" /></label>
          <label className="text-xs">HEX opcional<input value={color.swatchHex || ''} placeholder="#E9E1D2" pattern="#[0-9a-fA-F]{6}" onChange={event => update(index, { swatchHex: event.target.value || null })} className="mt-1 w-full rounded border border-border bg-background p-2" /></label>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <label><input type="checkbox" checked={color.active} onChange={event => update(index, { active: event.target.checked })} /> Activo</label>
          <label>Orden <input type="number" min={0} value={color.order} onChange={event => update(index, { order: Number(event.target.value) })} className="w-16 rounded border border-border bg-background p-2" /></label>
          {!color.id && <button type="button" onClick={() => onChange(colors.filter((_, i) => i !== index))} className="text-destructive">Quitar color nuevo</button>}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PRODUCT_SIZES.map(size => <label key={size} className="text-xs">{size}<input type="number" min={0} step={1} required value={color.sizeStocks.find(row => row.size === size)?.stock || 0} onChange={event => update(index, { sizeStocks: color.sizeStocks.map(row => row.size === size ? { ...row, stock: Number(event.target.value) } : row) })} className="mt-1 w-full rounded border border-border bg-background p-2" /></label>)}</div>
        <div className="grid grid-cols-3 gap-2">{color.images.map((url, imageIndex) => <div key={url} className="relative aspect-[4/5] overflow-hidden rounded-lg"><Image src={url} alt={`${color.name} ${imageIndex + 1}`} fill sizes="160px" className="object-cover" /><button type="button" aria-label={`Quitar imagen ${imageIndex + 1} de ${color.name}`} onClick={() => update(index, { images: color.images.filter((_, i) => i !== imageIndex) })} className="absolute right-1 top-1 rounded bg-black/80 px-2 py-1 text-white">×</button></div>)}</div>
        <label className="block text-xs">Imágenes del color (máximo 3, 10 MB cada una)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={busy || color.images.length >= 3} onChange={event => upload(event, index)} className="mt-2 block w-full text-xs" /></label>
      </fieldset>)}
      <button type="button" disabled={busy || colors.length >= 20} onClick={() => onChange([...colors, { clientId: crypto.randomUUID(), name: '', swatchHex: null, order: colors.length, active: true, images: [], sizeStocks: PRODUCT_SIZES.map(size => ({ size, stock: 0 })) }])} className="rounded-lg border border-border px-4 py-2 text-sm">+ Agregar color</button>
      {!!colors.length && <p className="text-sm text-muted-foreground">Stock total: {colors.reduce((sum, color) => sum + color.sizeStocks.reduce((total, row) => total + row.stock, 0), 0)} unidades. Los colores inactivos conservan stock, pero no se pueden comprar.</p>}
    </section>
    <section className="space-y-3 rounded-xl border border-border p-4" aria-label="Imagen promocional Home">
      <h2 className="font-semibold">Imagen promocional Home (opcional)</h2>
      <p className="text-xs text-muted-foreground">Una foto para el carrusel y el drop estrenado. Al quitarla se utiliza la imagen principal.</p>
      {homeImage && <div className="relative aspect-video overflow-hidden rounded-lg"><Image src={homeImage} alt="Promoción Home" fill sizes="640px" className="object-contain" /></div>}
      <label className="block text-sm">{homeImage ? 'Reemplazar imagen' : 'Subir imagen'}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={event => upload(event)} className="mt-2 block w-full text-xs" /></label>
      {homeImage && <button type="button" disabled={busy} onClick={() => onHomeChange('')} className="text-sm text-destructive">Quitar imagen Home</button>}
    </section>
  </>
}
