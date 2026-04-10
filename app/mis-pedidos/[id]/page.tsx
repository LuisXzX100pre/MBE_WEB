// app/mis-pedidos/[id]/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { notFound, redirect } from 'next/navigation'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ArrowLeft, PackageCheck, Truck, CreditCard, MapPin } from 'lucide-react'

async function getOrderForUser(orderId: string, userId: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      userId,
    },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: {
                orderBy: { order: 'asc' },
                take: 1,
              },
            },
          },
        },
      },
      payment: true,
    },
  })
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
      return 'Enviado'
    case 'DELIVERED':
      return 'Entregado'
    case 'CANCELLED':
      return 'Cancelado'
    default:
      return status
  }
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

function getProgressStep(status: string) {
  switch (status) {
    case 'PENDING':
      return 1
    case 'PAID':
      return 2
    case 'PROCESSING':
      return 3
    case 'SHIPPED':
      return 4
    case 'DELIVERED':
      return 5
    default:
      return 1
  }
}

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = await params
  const order = await getOrderForUser(id, user.id)

  if (!order) {
    notFound()
  }

  const currentStep = getProgressStep(order.status)

  const shippingLines = order.shippingAddress
    ? order.shippingAddress.split('\n').filter(Boolean)
    : []

  const timeline = [
    'Pendiente',
    'Pagado',
    'Procesando',
    'Enviado',
    'Entregado',
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <Link
              href="/mis-pedidos"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver a mis pedidos
            </Link>

            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground mb-2">
                  Pedido
                </p>
                <h1 className="text-2xl md:text-4xl font-black tracking-tight break-all">
                  #{order.id}
                </h1>
              </div>

              <span
                className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-medium ${getStatusStyles(
                  order.status
                )}`}
              >
                {getStatusLabel(order.status)}
              </span>
            </div>
          </div>

          {order.status !== 'CANCELLED' && (
            <div className="rounded-3xl border border-border bg-card p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-4">
                {timeline.map((label, index) => {
                  const stepNumber = index + 1
                  const active = stepNumber <= currentStep
                  const lineActive = stepNumber < currentStep

                  return (
                    <div
                      key={label}
                      className="relative flex flex-col items-center text-center"
                    >
                      {index < timeline.length - 1 && (
                        <>
                          <div className="hidden md:block absolute top-6 left-1/2 w-full h-[2px] bg-secondary" />
                          <div
                            className={`hidden md:block absolute top-6 left-1/2 h-[2px] transition-all duration-500 ${
                              lineActive ? 'w-full bg-primary' : 'w-0 bg-primary'
                            }`}
                          />
                        </>
                      )}

                      <div
                        className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                          active
                            ? 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,255,255,0.18)]'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {stepNumber}
                      </div>

                      <p
                        className={`mt-3 text-xs md:text-sm font-medium transition-colors ${
                          active ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {label}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
            <div className="rounded-3xl border border-border bg-card p-6">
              <h2 className="text-xl font-bold mb-5">Productos</h2>

              <div className="space-y-4">
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex gap-4 rounded-2xl border border-border/70 bg-background/40 p-4"
                  >
                    <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-secondary flex-shrink-0">
                      {item.product.images[0] ? (
                        <Image
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Cantidad: {item.quantity}
                      </p>
                      {item.size && (
                        <p className="text-sm text-muted-foreground">
                          Talla: {item.size}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="font-bold">${item.unitPrice.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        ${(item.unitPrice * item.quantity).toFixed(2)} MXN
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border border-border bg-card p-6">
                <h2 className="text-xl font-bold mb-5">Resumen</h2>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <PackageCheck className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Fecha del pedido</p>
                      <p className="font-medium">
                        {new Date(order.createdAt).toLocaleDateString('es-MX', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Pago</p>
                      <p className="font-medium">
                        {order.payment?.provider || 'No disponible'}
                      </p>
                      {order.payment?.status && (
                        <p className="text-sm text-muted-foreground">
                          Estado: {order.payment.status}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm text-muted-foreground">Envio</p>
                      <div className="space-y-1">
                        {shippingLines.map((line, index) => (
                          <p key={index} className="font-medium break-words">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {(order.status === 'SHIPPED' || order.status === 'DELIVERED') && (
                    <div className="flex items-start gap-3">
                      <Truck className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Seguimiento</p>
                        <p className="font-medium">
                          Tu pedido ya va en camino.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 border-t border-border pt-5">
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                    <span>Subtotal</span>
                    <span>${order.total.toFixed(2)} MXN</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-black">
                    <span>Total</span>
                    <span>${order.total.toFixed(2)} MXN</span>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-card p-6">
                <h2 className="text-xl font-bold mb-3">Necesitas ayuda?</h2>
                <p className="text-muted-foreground text-sm mb-5">
                  Si tienes dudas sobre tu pedido, puedes contactarnos y mencionar tu numero de orden.
                </p>
                <p className="font-mono text-xs break-all text-muted-foreground">
                  {order.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}