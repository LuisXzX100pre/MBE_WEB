'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ExternalLink,
  FileText,
  Package,
  Truck,
  CreditCard,
  Loader2,
  Trash2,
  CheckCircle2,
  Clock3,
  PackageCheck,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  MapPin,
} from 'lucide-react'

type OrderItem = {
  id: string
  quantity: number
  unitPrice: number
  size?: string | null
  product: {
    name: string
  }
}

type OrderPayment = {
  id: string
  provider: string
  status: string
  transactionId: string | null
  payerEmail: string | null
}

type OrderUser = {
  username: string
}

type Order = {
  id: string
  total: number
  subtotal?: number | null
  shippingCost?: number | null
  status: string
  createdAt: string | Date

  shippingAddress?: string | null
  shippingEmail?: string | null
  shippingFullName?: string | null
  shippingPhone?: string | null
  shippingCarrier?: string | null
  shippingService?: string | null
  shippingRateId?: string | null
  shippingEstimatedDays?: number | null
  shippingTrackingNumber?: string | null
  shippingTrackingUrl?: string | null
  shippingLabelUrl?: string | null
  skydropxShipmentId?: string | null

  user: OrderUser
  items: OrderItem[]
  payment: OrderPayment | null
}

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'CONFIRMED', label: 'Confirmado' },
  { value: 'PAID', label: 'Pagado' },
  { value: 'PROCESSING', label: 'Procesando' },
  { value: 'SHIPPED', label: 'En camino' },
  { value: 'DELIVERED', label: 'Entregado' },
  { value: 'CANCELLED', label: 'Cancelado' },
] as const

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
    case 'CONFIRMED':
      return 'bg-orange-500/15 text-orange-400 border border-orange-500/20'
    default:
      return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
  }
}

function getStatusLabel(status: string) {
  return (
    STATUS_OPTIONS.find((option) => option.value === status)?.label || status
  )
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'PAID':
      return <ShieldCheck className="h-4 w-4" />
    case 'PROCESSING':
      return <Package className="h-4 w-4" />
    case 'SHIPPED':
      return <Truck className="h-4 w-4" />
    case 'DELIVERED':
      return <CheckCircle2 className="h-4 w-4" />
    case 'CANCELLED':
      return <Clock3 className="h-4 w-4" />
    case 'CONFIRMED':
      return <CreditCard className="h-4 w-4" />
    default:
      return <Clock3 className="h-4 w-4" />
  }
}

function isLocalDelivery(order: Order) {
  return (
    order.shippingRateId === 'mbe-local-benito-juarez-free' ||
    order.shippingCarrier === 'mbe-local' ||
    order.shippingCarrier === 'Entrega local MBE'
  )
}

function getShippingTitle(order: Order) {
  if (isLocalDelivery(order)) {
    return 'Entrega local MBE · Envío gratis en Cancún'
  }

  if (!order.shippingCarrier && !order.shippingService) {
    return 'Sin método de envío'
  }

  return `${order.shippingCarrier || '—'}${
    order.shippingService ? ` · ${order.shippingService}` : ''
  }`
}

function getTrackingText(order: Order) {
  if (isLocalDelivery(order)) {
    if (order.status === 'DELIVERED') return 'Entrega local completada'
    if (order.status === 'SHIPPED') return 'Reparto local en curso'
    if (order.status === 'PROCESSING') return 'Preparando entrega local'
    return 'Entrega local administrada por MBE'
  }

  return order.shippingTrackingNumber || '—'
}

export function OrdersPremiumManager({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const totalPaid = useMemo(
    () => orders.reduce((acc, order) => acc + Number(order.total || 0), 0),
    [orders]
  )

  const totalLocal = useMemo(
    () => orders.filter((order) => isLocalDelivery(order)).length,
    [orders]
  )

  const totalDelivered = useMemo(
    () => orders.filter((order) => order.status === 'DELIVERED').length,
    [orders]
  )

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      setUpdatingId(orderId)

      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo actualizar la orden')
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'No se pudo actualizar la orden')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDelete = async (orderId: string) => {
    const ok = window.confirm('¿Seguro que quieres eliminar esta orden cancelada?')
    if (!ok) return

    try {
      setUpdatingId(orderId)

      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo eliminar la orden')
      }

      router.refresh()
    } catch (error) {
      console.error(error)
      alert(error instanceof Error ? error.message : 'No se pudo eliminar la orden')
    } finally {
      setUpdatingId(null)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
        Aún no hay órdenes pagadas.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Órdenes
          </p>
          <p className="mt-3 text-3xl font-black">{orders.length}</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Ingresos pagados
          </p>
          <p className="mt-3 text-3xl font-black">{money(totalPaid)}</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
            Local / Entregadas
          </p>
          <p className="mt-3 text-3xl font-black">
            {totalLocal} / {totalDelivered}
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {orders.map((order) => {
          const expanded = expandedId === order.id
          const localDelivery = isLocalDelivery(order)
          const isUpdating = updatingId === order.id

          return (
            <div
              key={order.id}
              className="overflow-hidden rounded-3xl border border-border bg-card"
            >
              <div className="p-6">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="break-all text-lg font-bold">#{order.id}</h2>

                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                          order.status
                        )}`}
                      >
                        {getStatusIcon(order.status)}
                        {getStatusLabel(order.status)}
                      </span>

                      {localDelivery && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-medium text-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          Entrega local MBE
                        </span>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-2 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
                      <p>
                        <span className="font-medium text-foreground">Cliente:</span>{' '}
                        {order.user.username}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Email:</span>{' '}
                        {order.payment?.payerEmail || order.shippingEmail || '—'}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Fecha:</span>{' '}
                        {new Date(order.createdAt).toLocaleString('es-MX')}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Subtotal:</span>{' '}
                        {money(order.subtotal ?? order.total)}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Envío:</span>{' '}
                        {money(order.shippingCost)}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Total:</span>{' '}
                        {money(order.total)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        disabled={isUpdating}
                        className="bg-transparent text-sm font-medium text-foreground outline-none"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            className="bg-black text-white"
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>

                      {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>

                    <Link
                      href={`/mis-pedidos/${order.id}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
                    >
                      <Package className="h-4 w-4" />
                      Ver pedido
                    </Link>

                    {!localDelivery && order.shippingTrackingUrl && (
                      <a
                        href={order.shippingTrackingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Tracking
                      </a>
                    )}

                    {!localDelivery && order.shippingLabelUrl && (
                      <a
                        href={order.shippingLabelUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
                      >
                        <FileText className="h-4 w-4" />
                        Guía
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : order.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium hover:bg-white/[0.08]"
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Ocultar
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Detalle
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-6 space-y-6">
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
                      <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Truck className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold">Envío</h3>
                        </div>

                        <div className="space-y-2 text-sm">
                          <p>
                            <span className="text-muted-foreground">Destinatario:</span>{' '}
                            <span className="font-medium">
                              {order.shippingFullName || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Teléfono:</span>{' '}
                            <span className="font-medium">
                              {order.shippingPhone || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Dirección:</span>{' '}
                            <span className="break-words font-medium">
                              {order.shippingAddress || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Método:</span>{' '}
                            <span className="font-medium">
                              {getShippingTitle(order)}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Rate ID:</span>{' '}
                            <span className="break-all font-mono text-xs">
                              {order.shippingRateId || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Tracking:</span>{' '}
                            <span className="break-all font-medium">
                              {getTrackingText(order)}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Shipment:</span>{' '}
                            <span className="break-all font-mono text-xs">
                              {localDelivery
                                ? 'No aplica'
                                : order.skydropxShipmentId || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Días estimados:</span>{' '}
                            <span className="font-medium">
                              {typeof order.shippingEstimatedDays === 'number'
                                ? `${order.shippingEstimatedDays} día(s)`
                                : localDelivery
                                  ? 'Entrega local'
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
                            <span className="font-medium">
                              {order.payment?.provider || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Estado:</span>{' '}
                            <span className="font-medium">
                              {order.payment?.status || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Transaction ID:</span>{' '}
                            <span className="break-all font-mono text-xs">
                              {order.payment?.transactionId || '—'}
                            </span>
                          </p>
                          <p>
                            <span className="text-muted-foreground">Payer Email:</span>{' '}
                            <span className="break-all font-medium">
                              {order.payment?.payerEmail || '—'}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <PackageCheck className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">Productos</h3>
                      </div>

                      <div className="space-y-2">
                        {order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex flex-col gap-2 rounded-xl border border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">
                                {item.product.name}
                              </p>
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

                    <div className="flex flex-wrap gap-3">
                      {order.status === 'PAID' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'PROCESSING')}
                          disabled={isUpdating}
                          className="rounded-full bg-blue-500/15 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/25 disabled:opacity-60"
                        >
                          Marcar como procesando
                        </button>
                      )}

                      {order.status === 'PROCESSING' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'SHIPPED')}
                          disabled={isUpdating}
                          className="rounded-full bg-violet-500/15 px-4 py-2 text-sm font-medium text-violet-400 hover:bg-violet-500/25 disabled:opacity-60"
                        >
                          {localDelivery ? 'Marcar como en camino' : 'Marcar como enviado'}
                        </button>
                      )}

                      {order.status === 'SHIPPED' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'DELIVERED')}
                          disabled={isUpdating}
                          className="rounded-full bg-green-500/15 px-4 py-2 text-sm font-medium text-green-400 hover:bg-green-500/25 disabled:opacity-60"
                        >
                          Marcar como entregado
                        </button>
                      )}

                      {!['CANCELLED', 'DELIVERED'].includes(order.status) && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                          disabled={isUpdating}
                          className="rounded-full bg-red-500/15 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-60"
                        >
                          Cancelar pedido
                        </button>
                      )}

                      {order.status === 'CANCELLED' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(order.id)}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-2 rounded-full bg-red-500/15 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/25 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar orden
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}