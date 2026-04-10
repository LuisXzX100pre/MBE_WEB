// components/admin/orders-table.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShoppingCart, ChevronDown, ChevronUp, Package, Truck, CheckCircle, Clock, XCircle, CreditCard, Trash2 } from 'lucide-react'

interface OrderItem {
  id: string
  quantity: number
  unitPrice: number
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
  status: string
  shippingAddress: string | null
  createdAt: Date
  user: { username: string }
  items: OrderItem[]
  payment: Payment | null
}

// Estados disponibles con descripciones
const statusOptions = [
  { value: 'PENDING', label: 'Pendiente', description: 'Esperando pago' },
  { value: 'CONFIRMED', label: 'Confirmado', description: 'Pago en proceso' },
  { value: 'PAID', label: 'Pagado', description: 'Pago recibido' },
  { value: 'PROCESSING', label: 'Procesando', description: 'Preparando pedido' },
  { value: 'SHIPPED', label: 'Enviado', description: 'En camino' },
  { value: 'DELIVERED', label: 'Entregado', description: 'Pedido completado' },
  { value: 'CANCELLED', label: 'Cancelado', description: 'Pedido cancelado' },
]

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-500',
  CONFIRMED: 'bg-orange-500/20 text-orange-500',
  PAID: 'bg-green-500/20 text-green-500',
  PROCESSING: 'bg-blue-500/20 text-blue-500',
  SHIPPED: 'bg-purple-500/20 text-purple-500',
  DELIVERED: 'bg-emerald-500/20 text-emerald-500',
  CANCELLED: 'bg-red-500/20 text-red-500',
}

const statusIcons: Record<string, React.ReactNode> = {
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

export function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  const handleStatusChange = async (orderId: string, status: string) => {
    setUpdating(orderId)
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      router.refresh()
    } catch (error) {
      console.error('Error updating order:', error)
    } finally {
      setUpdating(null)
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Estas seguro de eliminar esta orden cancelada?')) return
    
    setUpdating(orderId)
    try {
      await fetch(`/api/admin/orders/${orderId}`, {
        method: 'DELETE',
      })
      router.refresh()
    } catch (error) {
      console.error('Error deleting order:', error)
    } finally {
      setUpdating(null)
    }
  }

  if (orders.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-12 text-center">
        <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No hay ordenes aun</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Leyenda de estados */}
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

      {/* Tabla de ordenes */}
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
                <>
                  <tr key={order.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                    <td className="p-4 text-sm font-mono">{order.id.slice(0, 8)}...</td>
                    <td className="p-4 text-sm">{order.user.username}</td>
                    <td className="p-4 font-medium">${order.total.toFixed(2)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                          disabled={updating === order.id}
                          className={`text-xs px-3 py-1.5 rounded-full cursor-pointer border-0 font-medium ${
                            statusColors[order.status] || 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value} className="bg-card text-foreground">
                              {status.label}
                            </option>
                          ))}
                        </select>
                        {updating === order.id && (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      {order.payment ? (
                        <span className={`text-xs ${paymentStatusColors[order.payment.status] || 'text-muted-foreground'}`}>
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
                        onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                      >
                        {expandedId === order.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  </tr>
                  {expandedId === order.id && (
                    <tr className="bg-secondary/50">
                      <td colSpan={7} className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Productos */}
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              <Package className="w-4 h-4" />
                              Productos
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {order.items.map((item) => (
                                <li key={item.id} className="flex justify-between">
                                  <span>{item.quantity}x {item.product.name}</span>
                                  <span>${(item.unitPrice * item.quantity).toFixed(2)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Informacion adicional */}
                          <div className="space-y-4">
                            {/* Direccion de envio */}
                            {order.shippingAddress && (
                              <div>
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <Truck className="w-4 h-4" />
                                  Direccion de envio
                                </h4>
                                <p className="text-sm text-muted-foreground">{order.shippingAddress}</p>
                              </div>
                            )}

                            {/* Info del pago */}
                            {order.payment && (
                              <div>
                                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                                  <CreditCard className="w-4 h-4" />
                                  Informacion del pago
                                </h4>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  <p>Proveedor: {order.payment.provider}</p>
                                  {order.payment.transactionId && (
                                    <p>ID Transaccion: {order.payment.transactionId}</p>
                                  )}
                                  {order.payment.payerEmail && (
                                    <p>Email: {order.payment.payerEmail}</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Acciones rapidas */}
                        <div className="mt-4 pt-4 border-t border-border">
                          <h4 className="text-sm font-medium mb-2">Acciones rapidas:</h4>
                          <div className="flex flex-wrap gap-2">
                            {order.status === 'PAID' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'PROCESSING')}
                                disabled={updating === order.id}
                                className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-500 rounded-full hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                              >
                                Marcar como Procesando
                              </button>
                            )}
                            {order.status === 'PROCESSING' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'SHIPPED')}
                                disabled={updating === order.id}
                                className="px-3 py-1.5 text-xs bg-purple-500/20 text-purple-500 rounded-full hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                              >
                                Marcar como Enviado
                              </button>
                            )}
                            {order.status === 'SHIPPED' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'DELIVERED')}
                                disabled={updating === order.id}
                                className="px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-500 rounded-full hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
                              >
                                Marcar como Entregado
                              </button>
                            )}
                            {!['CANCELLED', 'DELIVERED'].includes(order.status) && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                                disabled={updating === order.id}
                                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-500 rounded-full hover:bg-red-500/30 transition-colors disabled:opacity-50"
                              >
                                Cancelar pedido
                              </button>
                            )}
                            {order.status === 'CANCELLED' && (
                              <button
                                onClick={() => handleDeleteOrder(order.id)}
                                disabled={updating === order.id}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
