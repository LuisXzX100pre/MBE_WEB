import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export async function productTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 20000 }) }
    catch (error) {
      const code = (error as { code?: string }).code
      if (attempt >= 3 || (code !== 'P2034' && code !== 'P2002')) throw error
    }
  }
}
export async function syncProductStock(tx: Prisma.TransactionClient, productId: string) {
  const product = await tx.product.findUniqueOrThrow({ where: { id: productId }, include: { colors: { include: { sizeStocks: true } }, sizes: true } })
  const stock = product.colors.length
    ? product.colors.reduce((sum, color) => sum + color.sizeStocks.reduce((total, size) => total + size.stock, 0), 0)
    : product.sizes.length ? product.sizes.reduce((sum, size) => sum + size.stock, 0) : product.stock
  return tx.product.update({ where: { id: productId }, data: { stock } })
}
