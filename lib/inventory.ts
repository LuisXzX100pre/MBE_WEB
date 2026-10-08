// lib/inventory.ts
import { prisma } from '@/lib/prisma'
import { productTransaction, syncProductStock } from '@/lib/product-transactions'
import { revalidatePath } from 'next/cache'

const STOCK_DISCOUNT_STATUSES = new Set([
  'PAID',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
])

function shouldDiscountInventory(status: string) {
  return STOCK_DISCOUNT_STATUSES.has(status)
}

async function getOrderWithItems(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  })
}

async function getAffectedProductRoutes(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      },
    },
  })

  if (!order) return null

  const productIds = Array.from(new Set(order.items.map((item) => item.productId)))
  const categorySlugs = Array.from(
    new Set(
      order.items
        .map((item) => item.product?.category?.slug)
        .filter((slug): slug is string => Boolean(slug))
    )
  )

  return {
    order,
    productIds,
    categorySlugs,
  }
}

async function changeOrderInventory(orderId: string, discount: boolean) {
  return productTransaction(async tx => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order) throw new Error('Orden no encontrada')
    if (order.inventoryDiscounted === discount) return order
    // Claim the transition inside the same transaction; rollback restores the flag if any line fails.
    const claimed = await tx.order.updateMany({ where: { id: orderId, inventoryDiscounted: !discount }, data: { inventoryDiscounted: discount } })
    if (!claimed.count) return tx.order.findUniqueOrThrow({ where: { id: orderId } })
    for (const item of order.items) {
      if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new Error('Cantidad inválida en orden')
      const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } })
      const operation = discount ? { decrement: item.quantity } : { increment: item.quantity }
      if (item.productColorId) {
        if (!item.size) throw new Error('La variante requiere talla')
        const color = await tx.productColor.findUnique({ where: { id: item.productColorId } })
        if (!color || color.productId !== product.id) throw new Error('Color inválido en orden')
        // Fulfill/restore historical orders even if ADMIN subsequently deactivates the color.
        const updated = await tx.productColorSize.updateMany({ where: { colorId: color.id, size: item.size, ...(discount ? { stock: { gte: item.quantity } } : {}) }, data: { stock: operation } })
        if (!updated.count) throw new Error('Stock insuficiente o talla inexistente para ' + product.name + ' / ' + item.colorName + ' / ' + item.size)
      } else if (item.size) {
        const updated = await tx.productSize.updateMany({ where: { productId: product.id, size: item.size, ...(discount ? { stock: { gte: item.quantity } } : {}) }, data: { stock: operation } })
        if (!updated.count) throw new Error('Stock insuficiente o talla inexistente para ' + product.name + ' / ' + item.size)
      } else {
        const updated = await tx.product.updateMany({ where: { id: product.id, ...(discount ? { stock: { gte: item.quantity } } : {}) }, data: { stock: operation } })
        if (!updated.count) throw new Error('Stock insuficiente para ' + product.name)
      }
      await syncProductStock(tx, product.id)
    }
    return tx.order.findUniqueOrThrow({ where: { id: orderId } })
  })
}
export async function applyInventoryForOrder(orderId: string) { return changeOrderInventory(orderId, true) }
export async function restoreInventoryForOrder(orderId: string) { return changeOrderInventory(orderId, false) }

export async function syncInventoryByStatus(orderId: string, nextStatus: string) {
  if (shouldDiscountInventory(nextStatus)) {
    const order = await applyInventoryForOrder(orderId)
    await revalidateInventoryPaths(orderId)
    return order
  }

  if (nextStatus === 'CANCELLED') {
    const order = await restoreInventoryForOrder(orderId)
    await revalidateInventoryPaths(orderId)
    return order
  }

  return null
}

async function revalidateInventoryPaths(orderId: string) {
  const affected = await getAffectedProductRoutes(orderId)

  if (!affected) return

  revalidatePath('/')
  revalidatePath('/productos')
  revalidatePath('/admin/productos')
  revalidatePath('/mis-pedidos')
  revalidatePath(`/mis-pedidos/${orderId}`)

  for (const productId of affected.productIds) {
    revalidatePath(`/productos/${productId}`)
  }

  for (const categorySlug of affected.categorySlugs) {
    revalidatePath(`/categorias/${categorySlug}`)
  }
}
