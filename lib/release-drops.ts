import { prisma } from '@/lib/prisma'

export async function releaseExpiredDrops() {
  const now = new Date()

  await prisma.product.updateMany({
    where: {
      status: 'COMING_SOON',
      releaseAt: {
        not: null,
        lte: now,
      },
    },
    data: {
      status: 'ACTIVE',
    },
  })
}