// app/checkout/success/page.tsx
import Link from 'next/link'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { CheckCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

interface SearchParams {
  order_id?: string
  payment_intent?: string
}

async function syncOrderIfNeeded(orderId: string, paymentIntentId?: string) {
  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  })

  if (!existing || existing.status === 'PAID' || !paymentIntentId) {
    return
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)

    if (paymentIntent.status === 'succeeded') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { orderId },
          data: {
            provider: 'stripe',
            status: 'COMPLETED',
            transactionId: paymentIntent.id,
            paymentMethodId:
              typeof paymentIntent.payment_method === 'string'
                ? paymentIntent.payment_method
                : paymentIntent.payment_method?.id,
            payerEmail:
              paymentIntent.receipt_email ||
              paymentIntent.metadata.email ||
              undefined,
          },
        })

        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
          },
        })

        const userId = paymentIntent.metadata.userId
        if (userId) {
          const cart = await tx.cart.findUnique({
            where: { userId },
          })

          if (cart) {
            await tx.cartItem.deleteMany({
              where: { cartId: cart.id },
            })
          }
        }
      })
    }
  } catch (error) {
    console.error('[stripe:success-sync]', error)
  }
}

async function getOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      payment: true,
    },
  })
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  if (params.order_id) {
    await syncOrderIfNeeded(params.order_id, params.payment_intent)
  }

  const order = params.order_id ? await getOrder(params.order_id) : null

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-card rounded-lg border border-border p-8">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />

            <h1 className="text-3xl font-bold mb-4">Pago exitoso</h1>

            <p className="text-muted-foreground mb-6">
              Tu pedido ha sido procesado correctamente. Recibiras una confirmacion pronto.
            </p>

            {order && (
              <div className="bg-secondary rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-muted-foreground mb-2">Numero de orden:</p>
                <p className="font-mono text-sm">{order.id}</p>

                <p className="text-sm text-muted-foreground mt-4 mb-2">Total pagado:</p>
                <p className="text-xl font-bold">${order.total.toFixed(2)}</p>

                <p className="text-sm text-muted-foreground mt-4 mb-2">Estado:</p>
                <span className="inline-block px-3 py-1 text-sm rounded-full bg-green-500/20 text-green-500">
                  {order.status}
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Seguir comprando
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}