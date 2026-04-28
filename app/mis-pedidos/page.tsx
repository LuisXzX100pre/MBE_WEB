// app/mis-pedidos/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Package, ChevronRight, Truck } from 'lucide-react'

async function getUserOrders(userId: string) {
  return prisma.order.findMany({
    where: {
      userId,
      payment: {
        is: {
          status: 'COMPLETED',
        },
      },
    },
    include: {
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
          provider: true,
          status: true,
          payerEmail: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
    case 'PROCESSING':
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
    case 'SHIPPED':
      return 'bg-violet-500/15 text-violet-400 border border-violet-500/20'
    case 'DELIVERED':
      return 'bg-green-500/15 text-green-400 border border-green-500/20'
    case 'CANCELLED':
      return 'bg-red-500/15 text-red-400 border border-red-500/20'
    default:
      return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'Pendiente'
    case 'PAID':
      return 'Pagado'
    case 'PROCESSING':
      return 'Procesando'
    case 'SHIPPED':
      return 'En camino'
    case 'DELIVERED':
      return 'Entregado'
    case 'CANCELLED':
      return 'Cancelado'
    default:
      return status
  }
}

function isLocalDelivery(order: {
  shippingRateId?: string | null
  shippingCarrier?: string | null
}) {
  return (
    order.shippingRateId === 'mbe-local-benito-juarez-free' ||
    order.shippingCarrier === 'mbe-local' ||
    order.shippingCarrier === 'Entrega local MBE'
  )
}

export default async function MisPedidosPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const orders = await getUserOrders(user.id)

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground mb-2">
              Cuenta
            </p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              Mis pedidos
            </h1>
            <p className="text-muted-foreground mt-3">
              Revisa el estado de tus compras y consulta el detalle de cada orden.
            </p>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-10 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-3">Aún no tienes pedidos</h2>
              <p className="text-muted-foreground mb-6">
                Cuando completes una compra, tus pedidos aparecerán aquí.
              </p>
              <Link
                href="/productos"
                className="inline-flex items-center rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Ir a comprar
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {orders.map((order) => {
                const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)
                const firstItems = order.items.slice(0, 3).map((item) => item.product.name)
                const localDelivery = isLocalDelivery(order as any)

                return (
                  <Link
                    key={order.id}
                    href={`/mis-pedidos/${order.id}`}
                    className="block rounded-3xl border border-border bg-card p-6 hover:border-muted-foreground/40 transition-colors"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className="font-mono text-xs md:text-sm text-muted-foreground">
                            #{order.id}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusStyles(
                              order.status
                            )}`}
                          >
                            {getStatusLabel(order.status)}
                          </span>

                          {localDelivery && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                              <Truck className="h-3.5 w-3.5" />
                              Entrega local MBE
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mb-3">
                          {new Date(order.createdAt).toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>

                        <div className="space-y-1">
                          {firstItems.map((name, index) => (
                            <p key={index} className="text-sm md:text-base font-medium truncate">
                              {name}
                            </p>
                          ))}
                          {order.items.length > 3 && (
                            <p className="text-sm text-muted-foreground">
                              y {order.items.length - 3} producto(s) más...
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-4 lg:items-end">
                        <div className="grid grid-cols-2 gap-4 lg:text-right">
                          <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">
                              Total
                            </p>
                            <p className="text-lg font-black">${order.total.toFixed(2)} MXN</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground mb-1">
                              Artículos
                            </p>
                            <p className="text-lg font-black">{totalItems}</p>
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                          Ver detalle
                          <ChevronRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}