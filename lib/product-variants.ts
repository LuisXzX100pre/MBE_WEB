export const PRODUCT_SIZES = ['S', 'M', 'L', 'XL'] as const
export type ProductSizeValue = (typeof PRODUCT_SIZES)[number]
export type ColorVariant = {
  id: string; name: string; swatchHex: string | null; order: number; active: boolean
  images: { id?: string; url: string; order?: number }[]
  sizeStocks: { size: ProductSizeValue; stock: number }[]
}
type StockProduct = { stock?: number; sizes?: { stock: number }[]; colors?: ColorVariant[] }
type ImageProduct = { images: { url: string }[]; colors?: ColorVariant[]; homeHeroImageUrl?: string | null }

export function activeColors(product: { colors?: ColorVariant[] }) {
  return [...(product.colors || [])].filter(color => color.active).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}
export function colorStock(color: Pick<ColorVariant, 'sizeStocks'>) {
  return color.sizeStocks.reduce((sum, size) => sum + size.stock, 0)
}
export function productStock(product: StockProduct) {
  if (product.colors?.length) return activeColors(product).reduce((sum, color) => sum + colorStock(color), 0)
  return product.sizes?.length ? product.sizes.reduce((sum, size) => sum + size.stock, 0) : product.stock ?? 0
}
export function defaultColor(product: { colors?: ColorVariant[] }) {
  const colors = activeColors(product)
  return colors.find(color => colorStock(color) > 0) || colors[0] || null
}
export function productImage(product: ImageProduct) {
  const retainedColors = [...(product.colors || [])].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  return product.images[0]?.url || defaultColor(product)?.images[0]?.url || activeColors(product).find(color => color.images.length)?.images[0]?.url || retainedColors.find(color => color.images.length)?.images[0]?.url || null
}
export function homeHeroImage(product: ImageProduct) {
  return product.homeHeroImageUrl || productImage(product)
}
export function cartImage(item: { product: { images: { url: string }[] }; productColor?: { images: { url: string }[] } | null }) {
  // Never substitute another color's photo when a selected color has no image.
  return item.productColor ? item.productColor.images[0]?.url || null : item.product.images[0]?.url || null
}
export function variantKey(colorId: string | null, size: string | null) {
  return colorId ? `${colorId}:${size}` : `legacy:${size || 'NONE'}`
}
export class ProductSelectionError extends Error { readonly status = 400 }
export function validateSelection(product: StockProduct & { status: string; releaseAt?: Date | string | null }, colorId: string | null, size: string | null, quantity: number) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647) throw new ProductSelectionError('Cantidad inválida')
  if (product.status === 'INACTIVE' || (product.status === 'COMING_SOON' && (!product.releaseAt || new Date(product.releaseAt).getTime() > Date.now()))) throw new ProductSelectionError('Producto aún no disponible para compra')
  if (size && !PRODUCT_SIZES.includes(size as ProductSizeValue)) throw new ProductSelectionError('Talla inválida')
  let available: number
  let color: ColorVariant | null = null
  if (product.colors?.length) {
    color = product.colors.find(item => item.id === colorId) || null
    if (!color || !color.active) throw new ProductSelectionError('Selecciona un color activo de este producto')
    if (!size) throw new ProductSelectionError('Selecciona una talla')
    available = color.sizeStocks.find(item => item.size === size)?.stock || 0
  } else {
    if (colorId) throw new ProductSelectionError('El color no pertenece a este producto')
    if (product.sizes?.length && !size) throw new ProductSelectionError('Selecciona una talla')
    available = size ? (product.sizes as { size?: string; stock: number }[] | undefined)?.find(item => item.size === size)?.stock || 0 : product.stock || 0
  }
  if (available < quantity) throw new ProductSelectionError(`Solo hay ${available} unidades disponibles para esta selección`)
  return color
}
