'use client'

import { useEffect, useMemo, useState } from 'react'
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
  MapPin,
  Truck,
  ShieldCheck,
  Zap,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'
import { PaymentCardPreview } from '@/components/store/payment-card-preview'

interface CartItem {
  id: string
  quantity: number
  size?: string | null
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

type ShippingBucket = 'cheapest' | 'best_value' | 'express'

type ShippingOption = {
  bucket: ShippingBucket
  rateId: string
  carrier: string
  carrierDisplayName: string
  serviceName: string
  serviceCode?: string
  currency: string
  amount: number
  total: number
  estimatedDays: number | null
  pickup: boolean
}

type QuoteResponse = {
  success: boolean
  quotationId: string
  options: ShippingOption[]
  recommended?: {
    cheapest?: ShippingOption | null
    bestValue?: ShippingOption | null
    express?: ShippingOption | null
  }
}

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

function money(amount: number) {
  return `${amount.toFixed(2)} MXN`
}

function bucketLabel(bucket: ShippingBucket) {
  if (bucket === 'cheapest') return 'Más barato'
  if (bucket === 'best_value') return 'Mejor balance'
  return 'Express'
}

function bucketDescription(bucket: ShippingBucket) {
  if (bucket === 'cheapest') return 'La opción con menor costo total'
  if (bucket === 'best_value') return 'Buen equilibrio entre precio y velocidad'
  return 'La mejor velocidad disponible'
}

function bucketShortDescription(bucket: ShippingBucket) {
  if (bucket === 'cheapest') return 'Menor costo'
  if (bucket === 'best_value') return 'Más equilibrado'
  return 'Más rápido'
}

function bucketIcon(bucket: ShippingBucket) {
  if (bucket === 'cheapest') return <Truck className="h-4 w-4" />
  if (bucket === 'best_value') return <ShieldCheck className="h-4 w-4" />
  return <Zap className="h-4 w-4" />
}

function sortShippingOptions(options: ShippingOption[]) {
  const order: ShippingBucket[] = ['cheapest', 'best_value', 'express']
  return [...options].sort(
    (a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket)
  )
}

type OpenSection = 'shipping' | 'payment'

function CheckoutInner({ items, total }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [recipient, setRecipient] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cardholderName, setCardholderName] = useState('')

  const [postalCode, setPostalCode] = useState('')
  const [stateName, setStateName] = useState('')
  const [city, setCity] = useState('')
  const [colony, setColony] = useState('')
  const [street, setStreet] = useState('')
  const [extNumber, setExtNumber] = useState('')
  const [intNumber, setIntNumber] = useState('')
  const [reference, setReference] = useState('')
  const [furtherInformation, setFurtherInformation] = useState('')

  const [brand, setBrand] = useState<CardBrand>('unknown')
  const [isCvcFocused, setIsCvcFocused] = useState(false)
  const [numberComplete, setNumberComplete] = useState(false)
  const [expiryComplete, setExpiryComplete] = useState(false)
  const [cvcComplete, setCvcComplete] = useState(false)

  const [quoteLoading, setQuoteLoading] = useState(false)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [selectedShippingOption, setSelectedShippingOption] =
    useState<ShippingOption | null>(null)
  const [activeShippingBucket, setActiveShippingBucket] =
    useState<ShippingBucket>('cheapest')

  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<OpenSection>('shipping')

  const subtotal = useMemo(() => total, [total])
  const shippingCost = selectedShippingOption?.total ?? 0
  const grandTotal = subtotal + shippingCost

  const subtotalFormatted = useMemo(() => money(subtotal), [subtotal])
  const shippingFormatted = useMemo(() => money(shippingCost), [shippingCost])
  const grandTotalFormatted = useMemo(() => money(grandTotal), [grandTotal])

  const orderedShippingOptions = useMemo(
    () => sortShippingOptions(shippingOptions),
    [shippingOptions]
  )

  const visibleShippingOption = useMemo(() => {
    if (!orderedShippingOptions.length) return null
    return (
      orderedShippingOptions.find(
        (option) => option.bucket === activeShippingBucket
      ) || orderedShippingOptions[0]
    )
  }, [orderedShippingOptions, activeShippingBucket])

  useEffect(() => {
    if (selectedShippingOption) {
      setOpenSection('payment')
    }
  }, [selectedShippingOption])

  const validateAddressForQuote = () => {
    if (!recipient.trim()) return 'Falta el nombre del destinatario'
    if (!phone.trim()) return 'Falta el teléfono'
    if (!email.trim()) return 'Falta el correo electrónico'
    if (!postalCode.trim()) return 'Falta el código postal'
    if (!stateName.trim()) return 'Falta el estado'
    if (!city.trim()) return 'Falta la ciudad'
    if (!colony.trim()) return 'Falta la colonia'
    if (!street.trim()) return 'Falta la calle'
    return null
  }

  const handleQuoteShipping = async () => {
    const validationError = validateAddressForQuote()

    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setQuoteLoading(true)

    try {
      const response = await fetch('/api/shipping/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient,
          phone,
          email,
          postalCode,
          state: stateName,
          city,
          colony,
          street,
          extNumber,
          intNumber,
          reference,
          furtherInformation,
        }),
      })

      const data = (await response.json()) as QuoteResponse & { error?: string }

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo cotizar el envío')
      }

      if (!data.options?.length) {
        throw new Error('No se encontraron opciones de envío para esa dirección')
      }

      const sorted = sortShippingOptions(data.options)
      setShippingOptions(sorted)

      const preferred =
        data.recommended?.cheapest ||
        data.recommended?.bestValue ||
        data.recommended?.express ||
        sorted[0]

      if (preferred) {
        setSelectedShippingOption(preferred)
        setActiveShippingBucket(preferred.bucket)
      }
    } catch (err) {
      console.error('[shipping:quote]', err)
      setShippingOptions([])
      setSelectedShippingOption(null)
      setError(err instanceof Error ? err.message : 'Error al cotizar el envío')
    } finally {
      setQuoteLoading(false)
    }
  }

  const handleSelectShippingBucket = (bucket: ShippingBucket) => {
    setActiveShippingBucket(bucket)

    const found = orderedShippingOptions.find((option) => option.bucket === bucket)
    if (found) {
      setSelectedShippingOption(found)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      setError('Stripe aún no está listo. Recarga la página.')
      return
    }

    const cardNumberElement = elements.getElement(CardNumberElement)

    if (!cardNumberElement) {
      setError('No se pudo inicializar el formulario de tarjeta.')
      return
    }

    if (!recipient || !phone || !email || !cardholderName) {
      setError('Completa tus datos personales.')
      return
    }

    if (!postalCode || !stateName || !city || !colony || !street) {
      setError('Completa toda la dirección de envío.')
      return
    }

    if (!selectedShippingOption) {
      setError('Primero cotiza y selecciona una opción de envío.')
      setOpenSection('shipping')
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
          paymentIntentId,
          recipient,
          phone,
          email,
          cardholderName,
          postalCode,
          state: stateName,
          city,
          colony,
          street,
          extNumber,
          intNumber,
          reference,
          furtherInformation,
          selectedShippingOption,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo iniciar el pago')
      }

      if (data.paymentIntentId) {
        setPaymentIntentId(data.paymentIntentId)
      }

      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            name: cardholderName,
            email,
            phone,
            address: {
              line1: `${street} ${extNumber}`.trim(),
              line2: intNumber ? `Int ${intNumber}` : undefined,
              city,
              state: stateName,
              postal_code: postalCode,
              country: 'MX',
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
        throw new Error('Stripe no devolvió el PaymentIntent')
      }

      if (result.paymentIntent.status === 'succeeded') {
        window.location.href = `/checkout/success?payment_intent=${result.paymentIntent.id}`
        return
      }

      if (result.paymentIntent.status === 'processing') {
        window.location.href = `/checkout/pending?payment_intent=${result.paymentIntent.id}`
        return
      }

      window.location.href = `/checkout/failure?payment_intent=${result.paymentIntent.id}`
    } catch (err) {
      console.error('[stripe:checkout-form]', err)
      setError(
        err instanceof Error ? err.message : 'Error al procesar el pago'
      )
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.05fr_1.25fr]">
      <div className="rounded-[28px] border border-white/10 bg-card/60 p-6 backdrop-blur-xl md:p-7">
        <h2 className="mb-5 text-xl font-bold">Resumen del pedido</h2>

        <div className="mb-6 space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-4 rounded-2xl border border-border/60 bg-background/40 p-3"
            >
              <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-secondary">
                {item.product.images[0] ? (
                  <Image
                    src={item.product.images[0].url}
                    alt={item.product.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {item.quantity} x {money(item.product.price)}
                  {item.size ? ` · Talla ${item.size}` : ''}
                </p>
              </div>

              <p className="whitespace-nowrap font-medium">
                {money(item.quantity * item.product.price)}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-2xl border border-border/70 bg-background/40 p-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Subtotal</span>
            <span>{subtotalFormatted}</span>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Envío</span>
            <span>
              {selectedShippingOption ? shippingFormatted : 'Cotiza tu envío'}
            </span>
          </div>

          <div className="h-px bg-white/10" />

          <div className="flex items-center justify-between text-lg font-bold">
            <span>Total</span>
            <span>{grandTotalFormatted}</span>
          </div>
        </div>

        {selectedShippingOption && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-white/85">
              <Truck className="h-4 w-4" />
              <span className="text-sm font-semibold">Envío seleccionado</span>
            </div>

            <p className="text-sm text-white/75">
              {selectedShippingOption.carrierDisplayName} ·{' '}
              {selectedShippingOption.serviceName}
            </p>

            <p className="mt-1 text-xs text-white/50">
              {bucketLabel(selectedShippingOption.bucket)}
              {selectedShippingOption.estimatedDays
                ? ` · ${selectedShippingOption.estimatedDays} día(s) estimado(s)`
                : ''}
            </p>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>Pago protegido con Stripe</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] p-5 backdrop-blur-xl md:p-7">
          <div className="mb-6">
            <p className="mb-2 text-xs uppercase tracking-[0.35em] text-white/45">
              Checkout
            </p>
            <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">
              Pago con tarjeta
            </h2>
            <p className="mt-2 text-sm text-white/55">
              Dirección, envío y pago dentro de tu tienda.
            </p>
          </div>

          <div className="space-y-4">
            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025]">
              <button
                type="button"
                onClick={() =>
                  setOpenSection(openSection === 'shipping' ? 'payment' : 'shipping')
                }
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-white/80" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">
                      1. Cotización de envío
                    </h3>
                  </div>

                  <p className="mt-2 text-sm text-white/55">
                    {selectedShippingOption
                      ? `${selectedShippingOption.carrierDisplayName} · ${selectedShippingOption.serviceName} · ${money(
                          selectedShippingOption.total
                        )}`
                      : 'Completa tu dirección, cotiza y elige la opción de envío'}
                  </p>
                </div>

                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-white/65 transition-transform ${
                    openSection === 'shipping' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSection === 'shipping' && (
                <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Destinatario
                      </label>
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Nombre completo de quien recibe"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="+52 998..."
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Correo electrónico
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

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Código postal
                      </label>
                      <input
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="77500"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Estado
                      </label>
                      <input
                        type="text"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Quintana Roo"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Ciudad / Municipio
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Cancún"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Colonia
                      </label>
                      <input
                        type="text"
                        value={colony}
                        onChange={(e) => setColony(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Centro"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Calle
                      </label>
                      <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Av. Ejemplo"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Número exterior
                      </label>
                      <input
                        type="text"
                        value={extNumber}
                        onChange={(e) => setExtNumber(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="123"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Número interior
                      </label>
                      <input
                        type="text"
                        value={intNumber}
                        onChange={(e) => setIntNumber(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Opcional"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Referencia
                      </label>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Casa blanca, portón negro, frente al parque..."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-white/90">
                        Información adicional
                      </label>
                      <textarea
                        value={furtherInformation}
                        onChange={(e) => setFurtherInformation(e.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                        placeholder="Indicaciones extra para la entrega"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleQuoteShipping}
                    disabled={quoteLoading}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white px-5 py-3.5 font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                  >
                    {quoteLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Cotizando envío...
                      </>
                    ) : (
                      <>
                        <Truck className="h-5 w-5" />
                        Cotizar envío
                      </>
                    )}
                  </button>

                  {shippingOptions.length > 0 && visibleShippingOption && (
                    <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {orderedShippingOptions.map((option) => {
                          const active = activeShippingBucket === option.bucket

                          return (
                            <button
                              key={option.rateId}
                              type="button"
                              onClick={() => handleSelectShippingBucket(option.bucket)}
                              className={`rounded-[18px] border px-4 py-3 text-left transition-all ${
                                active
                                  ? 'border-white bg-white text-black shadow-[0_12px_30px_rgba(255,255,255,0.10)]'
                                  : 'border-white/10 bg-white/[0.03] text-white hover:border-white/20 hover:bg-white/[0.05]'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {bucketIcon(option.bucket)}
                                <span className="text-sm font-semibold">
                                  {bucketLabel(option.bucket)}
                                </span>
                              </div>

                              <p
                                className={`mt-1 text-xs ${
                                  active ? 'text-black/65' : 'text-white/50'
                                }`}
                              >
                                {bucketShortDescription(option.bucket)}
                              </p>
                            </button>
                          )
                        })}
                      </div>

                      <div className="rounded-[20px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white">
                              {bucketIcon(visibleShippingOption.bucket)}
                              {bucketLabel(visibleShippingOption.bucket)}
                            </div>

                            <h4 className="mt-3 text-lg font-bold text-white">
                              {visibleShippingOption.carrierDisplayName}
                            </h4>

                            <p className="mt-1 text-sm text-white/72">
                              {visibleShippingOption.serviceName}
                            </p>

                            <p className="mt-3 text-sm text-white/58">
                              {bucketDescription(visibleShippingOption.bucket)}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75">
                                {visibleShippingOption.estimatedDays
                                  ? `${visibleShippingOption.estimatedDays} día(s) estimado(s)`
                                  : 'Sin tiempo estimado'}
                              </span>

                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75">
                                {visibleShippingOption.pickup
                                  ? 'Con recolección'
                                  : 'Entrega estándar'}
                              </span>
                            </div>
                          </div>

                          <div className="sm:text-right">
                            <p className="text-xs uppercase tracking-[0.22em] text-white/45">
                              Total del envío
                            </p>
                            <p className="mt-1 text-2xl font-black text-white">
                              {money(visibleShippingOption.total)}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedShippingOption(visibleShippingOption)
                            setOpenSection('payment')
                          }}
                          className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 font-semibold transition ${
                            selectedShippingOption?.rateId === visibleShippingOption.rateId
                              ? 'bg-white text-black'
                              : 'border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]'
                          }`}
                        >
                          <CheckCircle2 className="h-5 w-5" />
                          {selectedShippingOption?.rateId === visibleShippingOption.rateId
                            ? 'Opción seleccionada'
                            : 'Elegir esta opción'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025]">
              <button
                type="button"
                onClick={() => {
                  if (!selectedShippingOption) {
                    setOpenSection('shipping')
                    return
                  }
                  setOpenSection(openSection === 'payment' ? 'shipping' : 'payment')
                }}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left sm:px-5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-white/80" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">
                      2. Pago con tarjeta
                    </h3>
                  </div>

                  <p className="mt-2 text-sm text-white/55">
                    {selectedShippingOption
                      ? `Total a pagar: ${grandTotalFormatted}`
                      : 'Selecciona primero tu envío para continuar con el pago'}
                  </p>
                </div>

                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-white/65 transition-transform ${
                    openSection === 'payment' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openSection === 'payment' && (
                <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                  {!selectedShippingOption ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                      Primero elige una opción de envío para habilitar el pago.
                    </div>
                  ) : (
                    <>
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

                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/90">
                            Nombre del titular
                          </label>
                          <input
                            type="text"
                            value={cardholderName}
                            onChange={(e) =>
                              setCardholderName(e.target.value.toUpperCase())
                            }
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
                            placeholder="COMO APARECE EN LA TARJETA"
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-white/90">
                            Número de tarjeta
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

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-white/90">
                              Expiración
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
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="flex gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || quoteLoading || !stripe || !elements || !selectedShippingOption}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Procesando pago...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Pagar {grandTotalFormatted}
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-white/45">
            <Lock className="h-4 w-4" />
            <span>Los datos sensibles de tarjeta los procesa Stripe</span>
          </div>

          <Link
            href="/"
            className="block text-center text-sm text-white/55 transition-colors hover:text-white"
          >
            <ArrowLeft className="mr-1 inline h-4 w-4" />
            Seguir comprando
          </Link>
        </div>
      </form>
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