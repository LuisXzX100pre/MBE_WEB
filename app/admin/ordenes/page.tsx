// app/admin/ordenes/page.tsx
import { prisma } from '@/lib/prisma'
import { OrdersTable } from '@/components/admin/orders-table'

async function getOrders() {
  return prisma.order.findMany({
    where: {
      payment: {
        is: {
          status: 'COMPLETED',
        },
      },
    },
    include: {
      user: {
        select: {
          username: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              name: true,
            },
          },
        },
      },
      payment: {
        select: {
          id: true,
          provider: true,
          status: true,
          transactionId: true,
          payerEmail: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export default async function AdminOrdersPage() {
  const orders = await getOrders()

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground mb-2">
          Administración
        </p>
        <h1 className="text-3xl font-bold">Órdenes</h1>
      </div>

      <OrdersTable orders={orders as any} />
    </div>
  )
}