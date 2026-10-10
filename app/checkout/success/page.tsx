// app/checkout/success/page.tsx
import Link from 'next/link'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { CheckCircle } from 'lucide-react'

export default function CheckoutSuccessPage() {
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

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/mis-pedidos"
                className="px-6 py-3 bg-secondary text-secondary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Ver mis pedidos
              </Link>
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