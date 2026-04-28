// components/admin/orders-table.tsx
'use client'

import { type ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Trash2,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
  size?: string | null
  product: { name: string }
}

interface Payment {
  id: string
  provider: string
  status: string
  transactionId: string | null
  payerEmail: string | null
}

interface Order {
  id: string
  total: number
  subtotal?: number | null
  shippingCost?: number | null
  status: string
  shippingAddress: string | null
  shippingFullName?: string | null
  shippingEmail?: string | null
  shippingCarrier?: string | null
  shippingService?: string | null
  shippingRateId?: string | null
  shippingEstimatedDays?: number | null
  shippingTrackingNumber?: string | null
  shippingTrackingUrl?: string | null
  shippingLabelUrl?: string | null
  skydropxShipmentId?: string | null
  createdAt: Date | string
  user: { username: string }
  items: OrderItem[]
  payment: Payment | null
}

const statusOptions = [
  { value: 'PENDING', label: 'Pendiente', description: 'Esperando pago' },
  { value: 'CONFIRMED', label: 'Confirmado', description: 'Pago en proceso' },
  { value: 'PAID', label: 'Pagado', description: 'Pago recibido' },
  { value: 'PROCESSING', label: 'Procesando', description: 'Preparando pedido' },
  { value: 'SHIPPED', label: 'Enviado', description: 'En camino' },
  { value: 'DELIVERED', label: 'Entregado', description: 'Pedido completado' },
  { value: 'CANCELLED', label: 'Cancelado', description: 'Pedido cancelado' },
] as const

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-500',
  CONFIRMED: 'bg-orange-500/20 text-orange-500',
  PAID: 'bg-green-500/20 text-green-500',
  PROCESSING: 'bg-blue-500/20 text-blue-500',
  SHIPPED: 'bg-purple-500/20 text-purple-500',
  DELIVERED: 'bg-emerald-500/20 text-emerald-500',
  CANCELLED: 'bg-red-500/20 text-red-500',
}

const statusIcons: Record<string, ReactNode> = {
  PENDING: <Clock className="w-4 h-4" />,
  CONFIRMED: <CreditCard className="w-4 h-4" />,
  PAID: <CheckCircle className="w-4 h-4" />,
  PROCESSING: <Package className="w-4 h-4" />,
  SHIPPED: <Truck className="w-4 h-4" />,
  DELIVERED: <CheckCircle className="w-4 h-4" />,
  CANCELLED: <XCircle className="w-4 h-4" />,
}

const paymentStatusColors: Record<string, string> = {
  PENDING: 'text-yellow-500',
  COMPLETED: 'text-green-500',
  FAILED: 'text-red-500',
  REFUNDED: 'text-blue-500',
}

function money(value: number | null | undefined) {
  return `${Number(value || 0).toFixed(2)} MXN`
}

function isLocalDelivery(order: Order) {
  return (
    order.shippingRateId === 'mbe-local-benito-juarez-free' ||
    order.shippingCarrier === 'mbe-local' ||
    order.shippingCarrier === 'Entrega local MBE'
  )
}

function getShippingLine(order: Order) {
  if (!order.shippingCarrier && !order.shippingService) return '—'

  if (isLocalDelivery(order)) {
    return 'Entrega local MBE · Envío gratis en Cancún'
  }

  return `${order.shippingCarrier || '—'}${
    order.shippingService ? ` · ${order.shippingService}` : ''
  }`
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (orderId: string, status: string) => {
    setUpdating(orderId)

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar el estado')
      }

      router.refresh()
    } catch (error) {
      console.error('Error updating order:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la orden'
      )
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta orden cancelada?')) return

    setUpdating(orderId)

    try {
      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || 'No se pudo eliminar la orden')
      }

      router.refresh()
    } catch (error) {
      console.error('Error deleting order:', error)
      alert(
        error instanceof Error
          ? error.message
          : 'No se pudo eliminar la orden'
      )
    } finally {
      setUpdating(null)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No hay órdenes aún</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium mb-3">Estados del pedido:</h3>
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <div
              key={status.value}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${statusColors[status.value]}`}
              title={status.description}
            >
              {statusIcons[status.value]}
              {status.label}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-muted-foreground border-b border-border">
                <th className="p-4">ID</th>
                <th className="p-4">Usuario</th>
                <th className="p-4">Total</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Pago</th>
                <th className="p-4">Fecha</th>
                <th className="p-4"></th>
              </tr>
            </thead>

            <tbody>
              {orders.map((order) => (
                <FragmentRow
                  key={order.id}
                  order={order}
                  expanded={expandedId === order.id}
                  onToggle={() =>
                    setExpandedId(expandedId === order.id ? null : order.id)
                  }
                  updating={updating === order.id}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDeleteOrder}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FragmentRow({
  order,
  expanded,
  onToggle,
  updating,
  onStatusChange,
  onDelete,
}: {
  order: Order
  expanded: boolean
  onToggle: () => void
  updating: boolean
  onStatusChange: (orderId: string, status: string) => void
  onDelete: (orderId: string) => void
}) {
  const localDelivery = isLocalDelivery(order)

  return (
    <>
      <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
        <td className="p-4 text-sm font-mono">{order.id.slice(0, 8)}...</td>
        <td className="p-4 text-sm">{order.user.username}</td>
        <td className="p-4 font-medium">{money(order.total)}</td>
        <td className="p-4">
          <div className="flex items-center gap-2">
            <select
              value={order.status}
              onChange={(e) => onStatusChange(order.id, e.target.value)}
              disabled={updating}
              className={`text-xs px-3 py-1.5 rounded-full cursor-pointer border-0 font-medium ${
                statusColors[order.status] || 'bg-muted text-muted-foreground'
              }`}
            >
              {statusOptions.map((status) => (
                <option
                  key={status.value}
                  value={status.value}
                  className="bg-card text-foreground"
                >
                  {status.label}
                </option>
              ))}
            </select>

            {updating && (
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            )}
          </div>
        </td>
        <td className="p-4">
          {order.payment ? (
            <span
              className={`text-xs ${
                paymentStatusColors[order.payment.status] || 'text-muted-foreground'
              }`}
            >
              {order.payment.status}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Sin pago</span>
          )}
        </td>
        <td className="p-4 text-sm text-muted-foreground">
          {new Date(order.createdAt).toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </td>
        <td className="p-4">
          <button
            onClick={onToggle}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </td>
      </tr>

      {expanded && (
        <tr className="bg-secondary/50">
          <td colSpan={7} className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Productos
                </h4>

                <ul className="text-sm text-muted-foreground space-y-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>
                        {item.quantity}x {item.product.name}
                        {item.size ? ` · Talla ${item.size}` : ''}
                      </span>
                      <span>{money(item.unitPrice * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                {order.shippingAddress && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Truck className="w-4 h-4" />
                      Envío
                    </h4>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        Destinatario:{' '}
                        <span className="text-foreground font-medium">
                          {order.shippingFullName || '—'}
                        </span>
                      </p>
                      <p className="break-words">
                        Dirección:{' '}
                        <span className="text-foreground font-medium">
                          {order.shippingAddress}
                        </span>
                      </p>
                      <p>
                        Método:{' '}
                        <span className="text-foreground font-medium">
                          {getShippingLine(order)}
                        </span>
                      </p>
                      <p>
                        Rate ID:{' '}
                        <span className="font-mono text-xs text-foreground break-all">
                          {order.shippingRateId || '—'}
                        </span>
                      </p>
                      <p>
                        Seguimiento:{' '}
                        <span className="text-foreground font-medium break-all">
                          {localDelivery
                            ? order.status === 'DELIVERED'
                              ? 'Entrega local completada'
                              : order.status === 'SHIPPED'
                                ? 'Reparto local en curso'
                                : 'Entrega local administrada por MBE'
                            : order.shippingTrackingNumber || '—'}
                        </span>
                      </p>
                      <p>
                        Shipment SkydropX:{' '}
                        <span className="font-mono text-xs text-foreground break-all">
                          {localDelivery ? 'No aplica' : order.skydropxShipmentId || '—'}
                        </span>
                      </p>
                      <p>
                        Días estimados:{' '}
                        <span className="text-foreground font-medium">
                          {typeof order.shippingEstimatedDays === 'number'
                            ? `${order.shippingEstimatedDays} día(s)`
                            : localDelivery
                              ? 'Entrega local'
                              : '—'}
                        </span>
                      </p>

                      {!localDelivery && order.shippingTrackingUrl && (
                        <a
                          href={order.shippingTrackingUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.08]"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir tracking
                        </a>
                      )}

                      {!localDelivery && order.shippingLabelUrl && (
                        <a
                          href={order.shippingLabelUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white/[0.08]"
                        >
                          <FileText className="w-3 h-3" />
                          Ver guía
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {order.payment && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Información del pago
                    </h4>

                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Proveedor: {order.payment.provider}</p>
                      <p>Estado: {order.payment.status}</p>
                      {order.payment.transactionId && (
                        <p className="break-all">
                          ID Transacción: {order.payment.transactionId}
                        </p>
                      )}
                      {order.payment.payerEmail && (
                        <p className="break-all">Email: {order.payment.payerEmail}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-sm font-medium mb-2">Acciones rápidas:</h4>

              <div className="flex flex-wrap gap-2">
                {order.status === 'PAID' && (
                  <button
                    onClick={() => onStatusChange(order.id, 'PROCESSING')}
                    disabled={updating}
                    className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-500 rounded-full hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                  >
                    Marcar como Procesando
                  </button>
                )}

                {order.status === 'PROCESSING' && (
                  <button
                    onClick={() => onStatusChange(order.id, 'SHIPPED')}
                    disabled={updating}
                    className="px-3 py-1.5 text-xs bg-purple-500/20 text-purple-500 rounded-full hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                  >
                    {localDelivery ? 'Marcar como En camino' : 'Marcar como Enviado'}
                  </button>
                )}

                {order.status === 'SHIPPED' && (
                  <button
                    onClick={() => onStatusChange(order.id, 'DELIVERED')}
                    disabled={updating}
                    className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-500 rounded-full hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                  >
                    Marcar como Entregado
                  </button>
                )}

                {!['CANCELLED', 'DELIVERED'].includes(order.status) && (
                  <button
                    onClick={() => onStatusChange(order.id, 'CANCELLED')}
                    disabled={updating}
                    className="px-3 py-1.5 text-xs bg-red-500/20 text-red-500 rounded-full hover:bg-red-500/30 transition-colors disabled:opacity-50"
                  >
                    Cancelar pedido
                  </button>
                )}

                {order.status === 'CANCELLED' && (
                  <button
                    onClick={() => onDelete(order.id)}
                    disabled={updating}
                    className="px-3 py-1.5 text-xs bg-destructive/20 text-destructive rounded-full hover:bg-destructive/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Eliminar orden
                  </button>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}