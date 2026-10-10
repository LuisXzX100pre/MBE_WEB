import { productTransaction } from '@/lib/product-transactions'
import { productColorsInclude } from '@/lib/product-queries'
import { ProductSelectionError, validateSelection, variantKey, type ProductSizeValue } from '@/lib/product-variants'

export async function mutateCart(userId: string, body: Record<string, unknown>, action: 'add' | 'update' | 'remove') {
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const colorId = body.productColorId == null ? null : typeof body.productColorId === 'string' ? body.productColorId : ''
  const size = body.size == null ? null : typeof body.size === 'string' ? body.size : ''
  if (!productId || colorId === '' || size === '') throw new ProductSelectionError('Selección inválida')
  const quantity = action === 'remove' ? 0 : body.quantity === undefined && action === 'add' ? 1 : body.quantity
  if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < (action === 'add' ? 1 : 0) || quantity > 2147483647) throw new ProductSelectionError('Cantidad inválida')
  const key = variantKey(colorId, size)
  return productTransaction(async tx => {
    const cart = action === 'add'
      ? await tx.cart.upsert({ where: { userId }, create: { userId }, update: {} })
      : await tx.cart.findUnique({ where: { userId } })
    if (!cart) return
    const identity = { cartId_productId_variantKey: { cartId: cart.id, productId, variantKey: key } }
    const existing = await tx.cartItem.findUnique({ where: identity })
    if (quantity === 0) {
      if (existing) await tx.cartItem.delete({ where: { id: existing.id } })
      return
    }
    if (action !== 'add' && !existing) return
    const product = await tx.product.findUnique({ where: { id: productId }, include: { sizes: true, colors: productColorsInclude } })
    if (!product) throw new ProductSelectionError('Producto no encontrado')
    const next = action === 'add' ? (existing?.quantity || 0) + quantity : quantity
    validateSelection(product, colorId, size, next)
    await tx.cartItem.upsert({ where: identity,
      create: { cartId: cart.id, productId, productColorId: colorId, size: size as ProductSizeValue | null, variantKey: key, quantity: next },
      update: { quantity: next },
    })
  })
}
