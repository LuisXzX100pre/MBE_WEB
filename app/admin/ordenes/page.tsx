// app/admin/ordenes/page.tsx
import { prisma } from '@/lib/prisma'
import { OrdersTable } from '@/components/admin/orders-table'

async function getOrders() {
  const orders = await prisma.order.findMany({
    include: {
      user: { select: { username: true } },
      items: {
        include: {
          product: { select: { name: true } },
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
  return orders
}

export default async function AdminOrdersPage() {
  const orders = await getOrders()

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Ordenes</h1>
      <OrdersTable orders={orders} />
    </div>
  )
}
