// components/store/checkout-form.tsx
'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Elements,
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js'
import { loadStripe } from '@stripe/stripe-js'
import {
  ShoppingBag,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Lock,
  CreditCard,
} from 'lucide-react'
import { PaymentCardPreview } from '@/components/store/payment-card-preview'

interface CartItem {
  id: string
  quantity: number
  product: {
    id: string
    name: string
    price: number
    images: { url: string }[]
  }
}

interface CheckoutFormProps {
  items: CartItem[]
  total: number
}

type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'unionpay'
  | 'unknown'

const stripePromise =
  typeof window !== 'undefined' &&
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null

const baseStripeElementStyle = {
  style: {
    base: {
      color: '#ffffff',
      fontSize: '16px',
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      '::placeholder': {
        color: 'rgba(255,255,255,0.38)',
      },
      iconColor: '#ffffff',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
}

function CheckoutInner({ items, total }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [shippingAddress, setShippingAddress] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [email, setEmail] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [brand, setBrand] = useState<CardBrand>('unknown')
  const [isCvcFocused, setIsCvcFocused] = useState(false)
  const [numberComplete, setNumberComplete] = useState(false)
  const [expiryComplete, setExpiryComplete] = useState(false)
  const [cvcComplete, setCvcComplete] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalFormatted = useMemo(() => `${total.toFixed(2)} MXN`, [total])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      setError('Stripe aun no esta listo. Recarga la pagina.')
      return
    }

    const cardNumberElement = elements.getElement(CardNumberElement)

    if (!cardNumberElement) {
      setError('No se pudo inicializar el formulario de tarjeta.')
      return
    }

    if (!shippingAddress || !phoneNumber || !email || !cardholderName) {
      setError('Completa todos los campos requeridos.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shippingAddress,
          phoneNumber,
          email,
          cardholderName,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo iniciar el pago')
      }

      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: cardholderName,
            email,
            phone: phoneNumber,
            address: {
              line1: shippingAddress,
            },
          },
        },
      })

      if (result.error) {
        throw new Error(
          result.error.message || 'No se pudo confirmar el pago con tarjeta'
        )
      }

      if (!result.paymentIntent) {
        throw new Error('Stripe no devolvio el PaymentIntent')
      }

      if (result.paymentIntent.status === 'succeeded') {
        window.location.href = `/checkout/success?order_id=${data.orderId}&payment_intent=${result.paymentIntent.id}`
        return
      }

      if (result.paymentIntent.status === 'processing') {
        window.location.href = `/checkout/pending?order_id=${data.orderId}&payment_intent=${result.paymentIntent.id}`
        return
      }

      window.location.href = `/checkout/failure?order_id=${data.orderId}`
    } catch (err) {
      console.error('[stripe:checkout-form]', err)
      setError(
        err instanceof Error ? err.message : 'Error al procesar el pago'
      )
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.05fr_1.25fr] gap-8">
      <div className="rounded-[28px] border border-white/10 bg-card/60 backdrop-blur-xl p-6 md:p-7">
        <h2 className="text-xl font-bold mb-5">Resumen del pedido</h2>

        <div className="space-y-4 mb-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-3"
            >
              <div className="relative w-16 h-16 bg-secondary rounded-xl overflow-hidden flex-shrink-0">
                {item.product.images[0] ? (
                  <Image
                    src={item.product.images[0].url}
                    alt={item.product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ShoppingBag className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} x ${item.product.price.toFixed(2)} MXN
                </p>
              </div>

              <p className="font-medium whitespace-nowrap">
                ${(item.quantity * item.product.price).toFixed(2)} MXN
              </p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{totalFormatted}</span>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>Pago protegido con Stripe</span>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] backdrop-blur-xl p-5 md:p-7">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-[0.35em] text-white/45 mb-2">
            Checkout
          </p>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
            Pago con tarjeta
          </h2>
          <p className="mt-2 text-sm text-white/55">
            Debito o credito, dentro de tu tienda.
          </p>
        </div>

        <div className="mb-6">
          <PaymentCardPreview
            cardholderName={cardholderName}
            brand={brand}
            isCvcFocused={isCvcFocused}
            numberComplete={numberComplete}
            expiryComplete={expiryComplete}
            cvcComplete={cvcComplete}
          />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-white/90">
                Direccion de envio
              </label>
              <textarea
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                placeholder="Calle, numero, colonia, ciudad, codigo postal..."
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">
                Telefono
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                placeholder="+52 123 456 7890"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">
                Correo electronico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                placeholder="tu@email.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/90">
              Nombre del titular
            </label>
            <input
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value.toUpperCase())}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
              placeholder="COMO APARECE EN LA TARJETA"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/90">
              Numero de tarjeta
            </label>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-[17px] text-white transition focus-within:border-white/20 focus-within:bg-white/[0.07]">
              <CardNumberElement
                options={baseStripeElementStyle}
                onChange={(event) => {
                  setBrand((event.brand as CardBrand) || 'unknown')
                  setNumberComplete(Boolean(event.complete))
                  if (event.error) setError(event.error.message)
                  else setError(null)
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">
                Expiracion
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-[17px] text-white transition focus-within:border-white/20 focus-within:bg-white/[0.07]">
                <CardExpiryElement
                  options={baseStripeElementStyle}
                  onChange={(event) => {
                    setExpiryComplete(Boolean(event.complete))
                    if (event.error) setError(event.error.message)
                    else setError(null)
                  }}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-white/90">
                CVC
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-[17px] text-white transition focus-within:border-white/20 focus-within:bg-white/[0.07]">
                <CardCvcElement
                  options={baseStripeElementStyle}
                  onFocus={() => setIsCvcFocused(true)}
                  onBlur={() => setIsCvcFocused(false)}
                  onChange={(event) => {
                    setCvcComplete(Boolean(event.complete))
                    if (event.error) setError(event.error.message)
                    else setError(null)
                  }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !stripe || !elements}
            className="w-full rounded-2xl bg-white px-5 py-4 font-semibold text-black transition hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Procesando pago...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pagar {totalFormatted}
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-white/45">
            <Lock className="w-4 h-4" />
            <span>Los datos sensibles de tarjeta los procesa Stripe</span>
          </div>

          <Link
            href="/"
            className="block text-center text-sm text-white/55 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 inline mr-1" />
            Seguir comprando
          </Link>
        </form>
      </div>
    </div>
  )
}

export function CheckoutForm(props: CheckoutFormProps) {
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || !stripePromise) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
        Falta NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY en tus variables de entorno.
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutInner {...props} />
    </Elements>
  )
}