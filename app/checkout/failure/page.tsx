// app/checkout/failure/page.tsx
import Link from 'next/link'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { XCircle } from 'lucide-react'

export default function CheckoutFailurePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-card rounded-lg border border-border p-8">
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6" />
            
            <h1 className="text-3xl font-bold mb-4">Pago fallido</h1>
            
            <p className="text-muted-foreground mb-6">
              Hubo un problema al procesar tu pago. Por favor intenta nuevamente
              o usa otro metodo de pago.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/checkout"
                className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Intentar de nuevo
              </Link>
              <Link
                href="/"
                className="px-6 py-3 bg-secondary text-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
