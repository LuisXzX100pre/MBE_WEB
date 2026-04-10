// app/checkout/pending/page.tsx
import Link from 'next/link'
import { Header } from '@/components/store/header'
import { Footer } from '@/components/store/footer'
import { Clock } from 'lucide-react'

interface SearchParams {
  order_id?: string
}

export default async function CheckoutPendingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-card rounded-lg border border-border p-8">
            <Clock className="w-20 h-20 text-yellow-500 mx-auto mb-6" />
            
            <h1 className="text-3xl font-bold mb-4">Pago pendiente</h1>
            
            <p className="text-muted-foreground mb-6">
              Tu pago esta siendo procesado. Te notificaremos cuando se confirme.
              Esto puede tomar unos minutos.
            </p>

            {params.order_id && (
              <div className="bg-secondary rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-2">Numero de orden:</p>
                <p className="font-mono text-sm">{params.order_id}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/"
                className="px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-opacity"
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
