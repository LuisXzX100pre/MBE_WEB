import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import {
  ExternalLink,
  FileText,
  Package,
  Truck,
  CreditCard,
} from 'lucide-react'

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
}

function money(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} MXN`
}

function getStatusClasses(status: string) {
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

      <div className="space-y-5">
        {orders.map((order) => {
          const orderAny = order as typeof order & {
            shippingTrackingNumber?: string | null
            shippingTrackingUrl?: string | null
            shippingLabelUrl?: string | null
            skydropxShipmentId?: string | null
          }

          return (
            <div
              key={order.id}
              className="rounded-3xl border border-border bg-card p-6"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold break-all">#{order.id}</h2>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                    <p>
                      <span className="text-foreground font-medium">Cliente:</span>{' '}
                      {order.user.username}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Email:</span>{' '}
                      {order.payment?.payerEmail || order.shippingEmail || '—'}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Fecha:</span>{' '}
                      {new Date(order.createdAt).toLocaleString('es-MX')}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Subtotal:</span>{' '}
                      {money(order.subtotal ?? order.total)}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Envío:</span>{' '}
                      {money(order.shippingCost)}
                    </p>
                    <p>
                      <span className="text-foreground font-medium">Total:</span>{' '}
                      {money(order.total)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Link
                    href={`/mis-pedidos/${order.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
                  >
                    <Package className="h-4 w-4" />
                    Ver pedido
                  </Link>

                  {orderAny.shippingTrackingUrl && (
                    <a
                      href={orderAny.shippingTrackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Tracking
                    </a>
                  )}

                  {orderAny.shippingLabelUrl && (
                    <a
                      href={orderAny.shippingLabelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
                    >
                      <FileText className="h-4 w-4" />
                      Guía
                    </a>
                  )}
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Envío</h3>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Destinatario:</span>{' '}
                      <span className="font-medium">{order.shippingRecipient || '—'}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Dirección:</span>{' '}
                      <span className="font-medium break-words">
                        {order.shippingAddress || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Paquetería:</span>{' '}
                      <span className="font-medium">
                        {order.shippingCarrier || '—'}
                        {order.shippingService ? ` · ${order.shippingService}` : ''}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Rate ID:</span>{' '}
                      <span className="font-mono text-xs break-all">
                        {order.shippingRateId || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Tracking:</span>{' '}
                      <span className="font-medium break-all">
                        {orderAny.shippingTrackingNumber || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">SkydropX shipment:</span>{' '}
                      <span className="font-mono text-xs break-all">
                        {orderAny.skydropxShipmentId || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Días estimados:</span>{' '}
                      <span className="font-medium">
                        {typeof order.shippingDays === 'number'
                          ? `${order.shippingDays} día(s)`
                          : '—'}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">Pago</h3>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Proveedor:</span>{' '}
                      <span className="font-medium">{order.payment?.provider || '—'}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Estado:</span>{' '}
                      <span className="font-medium">{order.payment?.status || '—'}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Transaction ID:</span>{' '}
                      <span className="font-mono text-xs break-all">
                        {order.payment?.transactionId || '—'}
                      </span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Payer Email:</span>{' '}
                      <span className="font-medium break-all">
                        {order.payment?.payerEmail || '—'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-border/70 bg-background/40 p-4">
                <h3 className="font-semibold mb-3">Productos</h3>
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-xl border border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Cantidad: {item.quantity}
                          {item.size ? ` · Talla ${item.size}` : ''}
                        </p>
                      </div>

                      <div className="text-sm font-medium">
                        {money(item.unitPrice * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}

        {orders.length === 0 && (
          <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
            Aún no hay órdenes pagadas.
          </div>
        )}
      </div>
    </div>
  )
}