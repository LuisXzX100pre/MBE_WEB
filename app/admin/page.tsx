// app/admin/page.tsx
import { prisma } from '@/lib/prisma'
import { Package, Tags, ShoppingCart, DollarSign } from 'lucide-react'

async function getStats() {
  const [productsCount, categoriesCount, ordersCount, totalRevenue] =
    await Promise.all([
      prisma.product.count(),
      prisma.category.count(),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { status: 'PAID' },
        _sum: { total: true },
      }),
    ])

  return {
    productsCount,
    categoriesCount,
    ordersCount,
    totalRevenue: totalRevenue._sum.total || 0,
  }
}

async function getRecentOrders() {
  const orders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { username: true } },
      items: true,
    },
  })
  return orders
}

export default async function AdminDashboard() {
  const stats = await getStats()
  const recentOrders = await getRecentOrders()

  const statCards = [
    {
      label: 'Productos',
      value: stats.productsCount,
      icon: Package,
    },
    {
      label: 'Categorias',
      value: stats.categoriesCount,
      icon: Tags,
    },
    {
      label: 'Ordenes',
      value: stats.ordersCount,
      icon: ShoppingCart,
    },
    {
      label: 'Ingresos',
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
    },
  ]

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-card p-6 rounded-lg border border-border"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <stat.icon className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-bold">Ordenes recientes</h2>
        </div>
        <div className="p-6">
          {recentOrders.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-muted-foreground">
                  <th className="pb-4">ID</th>
                  <th className="pb-4">Usuario</th>
                  <th className="pb-4">Total</th>
                  <th className="pb-4">Estado</th>
                  <th className="pb-4">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="border-t border-border">
                    <td className="py-4 text-sm font-mono">
                      {order.id.slice(0, 8)}...
                    </td>
                    <td className="py-4 text-sm">{order.user.username}</td>
                    <td className="py-4 text-sm">${order.total.toFixed(2)}</td>
                    <td className="py-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          order.status === 'PAID'
                            ? 'bg-green-500/20 text-green-500'
                            : order.status === 'PENDING'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 text-sm text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No hay ordenes aun
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
