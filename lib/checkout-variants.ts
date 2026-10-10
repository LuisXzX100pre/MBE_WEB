import type { Size } from '@prisma/client'
import { ProductSelectionError } from '@/lib/product-variants'

export type OrderSelectionSnapshot = {
  productId: string; quantity: number; unitPrice: number; size: Size | null
  productColorId: string | null; colorName: string | null
}
export function orderSelectionSnapshot(item: {
  quantity: number; size: Size | null; productColorId: string | null
  product: { id: string; price: number; colors: { id: string; name: string }[] }
}): OrderSelectionSnapshot {
  return { productId: item.product.id, quantity: item.quantity, unitPrice: item.product.price, size: item.size,
    productColorId: item.productColorId, colorName: item.product.colors.find(color => color.id === item.productColorId)?.name || null }
}
// Color snapshots can exceed Stripe's 500-character limit for a metadata value.
// Keep the old single-field format when it fits; split only the snapshot, never amounts/provider settings.
export function cartSnapshotMetadata(items: OrderSelectionSnapshot[]): Record<string, string> {
  const json = JSON.stringify(items)
  if (json.length <= 500) return { cartSnapshot: json, cartSnapshotParts: '0' }
  const parts = Math.ceil(json.length / 500)
  if (parts > 25) throw new ProductSelectionError('Demasiados artículos para iniciar este pago')
  const metadata: Record<string, string> = { cartSnapshot: '', cartSnapshotParts: String(parts) }
  for (let index = 0; index < parts; index++) metadata['cartSnapshot' + index] = json.slice(index * 500, (index + 1) * 500)
  return metadata
}
export function readCartSnapshotMetadata(metadata: Record<string, string>) {
  if (metadata.cartSnapshot) return metadata.cartSnapshot
  const parts = Number(metadata.cartSnapshotParts)
  if (!Number.isInteger(parts) || parts < 1 || parts > 25) return undefined
  let json = ''
  for (let index = 0; index < parts; index++) {
    const part = metadata['cartSnapshot' + index]
    if (typeof part !== 'string' || part.length > 500) return undefined
    json += part
  }
  return json
}
