// lib/inventory.ts
import { prisma } from '@/lib/prisma'
import { Size } from '@prisma/client'
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

export async function applyInventoryForOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    })

    if (!order) {
      throw new Error('Orden no encontrada')
    }

    if (order.inventoryDiscounted) {
      return order
    }

    for (const item of order.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
        include: { sizes: true },
      })

      if (!product) {
        throw new Error('Producto no encontrado en la orden')
      }

      if (item.size) {
        const currentSize = product.sizes.find((s) => s.size === item.size)

        if (!currentSize) {
          throw new Error(
            `La talla ${item.size} no existe para el producto ${product.name}`
          )
        }

        if (currentSize.stock < item.quantity) {
          throw new Error(
            `No hay suficiente stock de ${product.name} talla ${item.size}`
          )
        }

        await tx.productSize.update({
          where: {
            productId_size: {
              productId: item.productId,
              size: item.size as Size,
            },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        })
      } else {
        if (product.stock < item.quantity) {
          throw new Error(`No hay suficiente stock de ${product.name}`)
        }
      }

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      })
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        inventoryDiscounted: true,
      },
    })

    return updatedOrder
  })
}

export async function restoreInventoryForOrder(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    })

    if (!order) {
      throw new Error('Orden no encontrada')
    }

    if (!order.inventoryDiscounted) {
      return order
    }

    for (const item of order.items) {
      if (item.size) {
        await tx.productSize.update({
          where: {
            productId_size: {
              productId: item.productId,
              size: item.size as Size,
            },
          },
          data: {
            stock: {
              increment: item.quantity,
            },
          },
        })
      }

      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            increment: item.quantity,
          },
        },
      })
    }

    const updatedOrder = await tx.order.update({
      where: { id: orderId },
      data: {
        inventoryDiscounted: false,
      },
    })

    return updatedOrder
  })
}

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