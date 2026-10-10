import { PRODUCT_SIZES, ProductSelectionError, type ProductSizeValue } from '@/lib/product-variants'
import type { Prisma } from '@prisma/client'

export class ProductEditConflict extends Error { readonly status = 409 }
export class ProductNotFound extends Error { readonly status = 404 }
const fail = (message: string): never => { throw new ProductSelectionError(message) }
function stock(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2147483647) fail('Stock inválido: utiliza enteros no negativos')
  return value as number
}
function imageUrl(value: unknown): string {
  if (typeof value !== 'string') return fail('URL de imagen inválida')
  if (/^\/uploads\/[^\s?#]+$/.test(value)) return value
  try { const url = new URL(value); if (url.protocol === 'https:' && !url.username && !url.password) return value } catch {}
  return fail('La imagen debe utilizar HTTPS o una imagen local existente')
}
function images(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 3) return fail('Máximo 3 imágenes por galería')
  return [...new Set(value.map(imageUrl))]
}
function sizes(value: unknown) {
  if (!Array.isArray(value)) return fail('Inventario por talla inválido')
  const rows = value.map(item => {
    if (!item || !PRODUCT_SIZES.includes(item.size)) return fail('Talla inválida')
    return { size: item.size as ProductSizeValue, stock: stock(item.stock) }
  })
  if (new Set(rows.map(item => item.size)).size !== rows.length) fail('Talla duplicada')
  return rows
}
export function parseProductInput(raw: unknown) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail('Solicitud inválida')
  const body = raw as Record<string, unknown>
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId.trim() : ''
  if (!name || !categoryId) fail('Nombre y categoría son requeridos')
  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) fail('Precio inválido')
  if (!['ACTIVE', 'COMING_SOON', 'INACTIVE'].includes(String(body.status))) fail('Estado inválido')
  const releaseAt = body.releaseAt ? new Date(String(body.releaseAt)) : null
  if (releaseAt && Number.isNaN(releaseAt.getTime())) fail('Fecha de lanzamiento inválida')
  if (body.status === 'COMING_SOON' && !releaseAt) fail('Debes definir la fecha del próximo drop')
  const legacyImages = images(body.images || [])
  const legacySizes = sizes(body.sizes || [])
  const colors = body.colors === undefined ? undefined : (() => {
    if (!Array.isArray(body.colors) || body.colors.length > 20) return fail('Variantes de color inválidas (máximo 20)')
    const result = body.colors.map((color, index) => {
      if (!color || typeof color !== 'object') return fail('Color inválido')
      const colorName = typeof color.name === 'string' ? color.name.trim() : ''
      if (!colorName || colorName.length > 80) fail('Nombre de color requerido (máximo 80 caracteres)')
      const swatchHex = color.swatchHex === '' || color.swatchHex == null ? null : color.swatchHex
      if (swatchHex !== null && (typeof swatchHex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(swatchHex))) fail('HEX inválido: usa #RRGGBB')
      if (color.active !== undefined && typeof color.active !== 'boolean') fail('Estado de color inválido')
      const sizeStocks = sizes(color.sizeStocks)
      if (sizeStocks.length !== 4) fail('Cada color requiere stock S, M, L y XL')
      const colorImages = images(color.images)
      if (color.active !== false && !colorImages.length) fail('Sube al menos una imagen para cada color activo')
      const order = color.order === undefined ? index : stock(color.order)
      if (color.id !== undefined && (typeof color.id !== 'string' || !color.id || color.id.includes(':'))) fail('ID de color inválido')
      return { id: color.id as string | undefined, name: colorName, swatchHex: swatchHex as string | null, order, active: color.active !== false, images: colorImages, sizeStocks }
    })
    const ids = result.filter(color => color.id).map(color => color.id)
    if (new Set(ids).size !== ids.length) fail('ID de color duplicado')
    return result
  })()
  if (!legacyImages.length && !colors?.some(color => color.images.length)) fail('Debes subir al menos una imagen')
  stock(legacySizes.reduce((sum, row) => sum + row.stock, 0))
  if (colors) stock(colors.reduce((sum, color) => sum + color.sizeStocks.reduce((total, row) => total + row.stock, 0), 0))
  const expectedUpdatedAt = body.expectedUpdatedAt ? new Date(String(body.expectedUpdatedAt)) : null
  if (expectedUpdatedAt && Number.isNaN(expectedUpdatedAt.getTime())) fail('Versión del producto inválida')
  return {
    data: { name, categoryId, price: body.price as number, description: typeof body.description === 'string' ? body.description.trim() || null : null,
      status: body.status as 'ACTIVE' | 'COMING_SOON' | 'INACTIVE', dropName: typeof body.dropName === 'string' ? body.dropName.trim() || null : null, releaseAt,
      homeHeroImageUrl: body.homeHeroImageUrl ? imageUrl(body.homeHeroImageUrl) : null },
    images: legacyImages, sizes: legacySizes, colors, expectedUpdatedAt,
    stock: legacySizes.length ? legacySizes.reduce((sum, item) => sum + item.stock, 0) : stock(body.stock ?? 0),
  }
}
export type ProductInput = ReturnType<typeof parseProductInput>

export async function saveProductImages(tx: Prisma.TransactionClient, productId: string, urls: string[]) {
  const existing = await tx.productImage.findMany({ where: { productId } })
  await tx.productImage.deleteMany({ where: { productId, url: { notIn: urls } } })
  for (const [order, url] of urls.entries()) {
    const image = existing.find(image => image.url === url)
    if (image) await tx.productImage.update({ where: { id: image.id }, data: { order } })
    else await tx.productImage.create({ data: { productId, url, order } })
  }
}

export async function saveProductColors(tx: Prisma.TransactionClient, productId: string, colors: ProductInput['colors']) {
  if (colors === undefined) return
  const existing = await tx.productColor.findMany({ where: { productId }, include: { sizeStocks: true } })
  for (const color of colors) if (color.id && !existing.some(item => item.id === color.id)) fail('El color no pertenece a este producto')
  // Omission deactivates instead of deleting; IDs, inventory and history remain available for restoration.
  await tx.productColor.updateMany({ where: { productId, id: { notIn: colors.flatMap(color => color.id ? [color.id] : []) } }, data: { active: false } })
  for (const color of colors) {
    const data = { name: color.name, swatchHex: color.swatchHex, order: color.order, active: color.active }
    const saved = color.id
      ? await tx.productColor.update({ where: { id: color.id }, data })
      : await tx.productColor.create({ data: { ...data, productId } })
    // Images have no order/cart references; removing a URL does not delete the Blob.
    await tx.productColorImage.deleteMany({ where: { colorId: saved.id } })
    await tx.productColorImage.createMany({ data: color.images.map((url, order) => ({ colorId: saved.id, url, order })) })
    for (const row of color.sizeStocks) await tx.productColorSize.upsert({
      where: { colorId_size: { colorId: saved.id, size: row.size } },
      create: { colorId: saved.id, ...row }, update: { stock: row.stock },
    })
  }
}
