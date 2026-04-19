// app/checkout/page.tsx
import { redirect } from 'next/navigation'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { getCurrentUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CheckoutForm } from '@/components/store/checkout-form'

async function getCart(userId: string) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: {
          product: {
            include: {
              images: { orderBy: { order: 'asc' }, take: 1 },
            },
          },
        },
      },
    },
  })

  return cart
}

export default async function CheckoutPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/')
  }

  const cart = await getCart(user.id)

  if (!cart || cart.items.length === 0) {
    redirect('/')
  }

  const total = cart.items.reduce(
    (sum, item) => sum + item.quantity * item.product.price,
    0
  )

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold mb-8">Checkout</h1>
          <CheckoutForm items={cart.items} total={total} />
        </div>
      </main>

      <Footer />
    </div>
  )
}