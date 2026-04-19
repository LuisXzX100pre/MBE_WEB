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
  X,
} from 'lucide-react'
import { PaymentCardPreview } from '@/components/store/payment-card-preview'
import { MX_STATES, getStateNameByCode, type MexicoMunicipality } from '@/lib/mx-locations'

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
type OpenSection = 'shipping' | 'payment'

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
  return 'La entrega más rápida disponible'
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

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-sm font-medium text-white/90"
    >
      {children}
    </label>
  )
}

function DarkInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  required = false,
  disabled = false,
  inputMode,
  maxLength,
}: {
  id?: string
  value: string
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void
  placeholder?: string
  type?: string
  required?: boolean
  disabled?: boolean
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  maxLength?: number
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      inputMode={inputMode}
      maxLength={maxLength}
    />
  )
}

function DarkTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>
  placeholder?: string
  rows?: number
}) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 outline-none transition focus:border-white/20 focus:bg-white/[0.07]"
      placeholder={placeholder}
    />
  )
}

function DarkSelect({
  id,
  value,
  onChange,
  required = false,
  disabled = false,
  children,
}: {
  id?: string
  value: string
  onChange: React.ChangeEventHandler<HTMLSelectElement>
  required?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className="w-full appearance-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-white outline-none transition focus:border-white/20 focus:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {children}
      </select>

      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
    </div>
  )
}

function AccordionHeader({
  title,
  subtitle,
  icon,
  isOpen,
  onClick,
  disabled = false,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  isOpen: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-white/[0.02] disabled:cursor-not-allowed disabled:opacity-70 sm:px-5"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/90">
            {title}
          </h3>
        </div>
        <p className="mt-2 text-sm text-white/55">{subtitle}</p>
      </div>

      <ChevronDown
        className={`h-5 w-5 shrink-0 text-white/65 transition-transform ${
          isOpen ? 'rotate-180' : ''
        }`}
      />
    </button>
  )
}

function ShippingOptionModal({
  open,
  options,
  activeBucket,
  onChangeBucket,
  onClose,
  onConfirm,
}: {
  open: boolean
  options: ShippingOption[]
  activeBucket: ShippingBucket
  onChangeBucket: (bucket: ShippingBucket) => void
  onClose: () => void
  onConfirm: (option: ShippingOption) => void
}) {
  const orderedOptions = useMemo(() => sortShippingOptions(options), [options])

  const currentOption =
    orderedOptions.find((option) => option.bucket === activeBucket) ||
    orderedOptions[0] ||
    null

  if (!open || !currentOption) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-[6px]"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0b0b0b] shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.06),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.04),transparent_24%)]" />

        <div className="relative border-b border-white/10 px-5 py-5 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                Envío
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-white">
                Elige tu opción
              </h3>
              <p className="mt-2 text-sm text-white/55">
                Selecciona la cotización que prefieras para continuar al pago.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/70 transition hover:bg-white/[0.08] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="relative px-5 py-5 sm:px-6 sm:py-6">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {orderedOptions.map((option) => {
              const active = activeBucket === option.bucket

              return (
                <button
                  key={option.rateId}
                  type="button"
                  onClick={() => onChangeBucket(option.bucket)}
                  className={`rounded-[18px] border px-4 py-4 text-left transition-all ${
                    active
                      ? 'border-white bg-white text-black shadow-[0_16px_40px_rgba(255,255,255,0.08)]'
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
                    className={`mt-2 text-xs ${
                      active ? 'text-black/65' : 'text-white/50'
                    }`}
                  >
                    {bucketShortDescription(option.bucket)}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.05] via-white/[0.02] to-transparent p-5">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white">
                  {bucketIcon(currentOption.bucket)}
                  {bucketLabel(currentOption.bucket)}
                </div>

                <h4 className="mt-4 text-xl font-black text-white">
                  {currentOption.carrierDisplayName}
                </h4>

                <p className="mt-1 text-sm text-white/72">
                  {currentOption.serviceName}
                </p>

                <p className="mt-4 text-sm text-white/58">
                  {bucketDescription(currentOption.bucket)}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75">
                    {currentOption.estimatedDays
                      ? `${currentOption.estimatedDays} día(s) estimado(s)`
                      : 'Sin tiempo estimado'}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/75">
                    {currentOption.pickup ? 'Con recolección' : 'Entrega estándar'}
                  </span>
                </div>
              </div>

              <div className="sm:text-right">
                <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                  Total del envío
                </p>
                <p className="mt-2 text-3xl font-black text-white">
                  {money(currentOption.total)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onConfirm(currentOption)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 font-semibold text-black transition hover:opacity-90"
            >
              <CheckCircle2 className="h-5 w-5" />
              Elegir esta opción
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CheckoutInner({ items, total }: CheckoutFormProps) {
  const stripe = useStripe()
  const elements = useElements()

  const [recipient, setRecipient] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [cardholderName, setCardholderName] = useState('')

  const [postalCode, setPostalCode] = useState('')
  const [stateCode, setStateCode] = useState('')
  const [stateName, setStateName] = useState('')
  const [city, setCity] = useState('')
  const [colony, setColony] = useState('')
  const [street, setStreet] = useState('')
  const [extNumber, setExtNumber] = useState('')
  const [intNumber, setIntNumber] = useState('')
  const [reference, setReference] = useState('')
  const [furtherInformation, setFurtherInformation] = useState('')

  const [municipalities, setMunicipalities] = useState<MexicoMunicipality[]>([])
  const [municipalitiesLoading, setMunicipalitiesLoading] = useState(false)

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
  const [shippingModalOpen, setShippingModalOpen] = useState(false)

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

  useEffect(() => {
    if (!stateCode) {
      setStateName('')
      setMunicipalities([])
      setCity('')
      return
    }

    const nextStateName = getStateNameByCode(stateCode)
    setStateName(nextStateName)
    setCity('')
    setMunicipalities([])
    setSelectedShippingOption(null)
    setShippingOptions([])

    let cancelled = false

    const loadMunicipalities = async () => {
      try {
        setMunicipalitiesLoading(true)

        const response = await fetch(`/api/mx/municipalities/${stateCode}`, {
          method: 'GET',
          cache: 'force-cache',
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'No se pudieron cargar los municipios')
        }

        if (!cancelled) {
          setMunicipalities(Array.isArray(data.municipalities) ? data.municipalities : [])
        }
      } catch (err) {
        console.error('[mx:municipalities]', err)
        if (!cancelled) {
          setMunicipalities([])
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los municipios'
          )
        }
      } finally {
        if (!cancelled) {
          setMunicipalitiesLoading(false)
        }
      }
    }

    loadMunicipalities()

    return () => {
      cancelled = true
    }
  }, [stateCode])

  const validateAddressForQuote = () => {
    if (!recipient.trim()) return 'Falta el nombre del destinatario'
    if (!phone.trim()) return 'Falta el teléfono'
    if (!email.trim()) return 'Falta el correo electrónico'
    if (!postalCode.trim()) return 'Falta el código postal'
    if (!stateName.trim()) return 'Falta el estado'
    if (!city.trim()) return 'Falta la ciudad o municipio'
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
        setActiveShippingBucket(preferred.bucket)
      }

      setShippingModalOpen(true)
    } catch (err) {
      console.error('[shipping:quote]', err)
      setShippingOptions([])
      setSelectedShippingOption(null)
      setError(err instanceof Error ? err.message : 'Error al cotizar el envío')
    } finally {
      setQuoteLoading(false)
    }
  }

  const handleConfirmShippingOption = (option: ShippingOption) => {
    setSelectedShippingOption(option)
    setActiveShippingBucket(option.bucket)
    setShippingModalOpen(false)
    setOpenSection('payment')
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
      setError('Primero cotiza y elige una opción de envío.')
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
    <>
      <ShippingOptionModal
        open={shippingModalOpen}
        options={shippingOptions}
        activeBucket={activeShippingBucket}
        onChangeBucket={setActiveShippingBucket}
        onClose={() => setShippingModalOpen(false)}
        onConfirm={handleConfirmShippingOption}
      />

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
                <AccordionHeader
                  title="1. Datos y envío"
                  subtitle={
                    selectedShippingOption
                      ? `${selectedShippingOption.carrierDisplayName} · ${selectedShippingOption.serviceName} · ${money(selectedShippingOption.total)}`
                      : 'Completa tu dirección y cotiza el envío'
                  }
                  icon={<MapPin className="h-4 w-4 text-white/80" />}
                  isOpen={openSection === 'shipping'}
                  onClick={() =>
                    setOpenSection(openSection === 'shipping' ? 'payment' : 'shipping')
                  }
                />

                {openSection === 'shipping' && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <FieldLabel htmlFor="recipient">Destinatario</FieldLabel>
                        <DarkInput
                          id="recipient"
                          value={recipient}
                          onChange={(e) => setRecipient(e.target.value)}
                          placeholder="Nombre completo de quien recibe"
                          required
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                        <DarkInput
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+52 998..."
                          required
                          inputMode="tel"
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="email">Correo electrónico</FieldLabel>
                        <DarkInput
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="tu@email.com"
                          required
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="postalCode">Código postal</FieldLabel>
                        <DarkInput
                          id="postalCode"
                          value={postalCode}
                          onChange={(e) =>
                            setPostalCode(e.target.value.replace(/[^\d]/g, '').slice(0, 5))
                          }
                          placeholder="77500"
                          required
                          inputMode="numeric"
                          maxLength={5}
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="stateCode">Estado</FieldLabel>
                        <DarkSelect
                          id="stateCode"
                          value={stateCode}
                          onChange={(e) => setStateCode(e.target.value)}
                          required
                        >
                          <option value="" className="bg-[#0b0b0b] text-white">
                            Selecciona un estado
                          </option>
                          {MX_STATES.map((state) => (
                            <option
                              key={state.code}
                              value={state.code}
                              className="bg-[#0b0b0b] text-white"
                            >
                              {state.name}
                            </option>
                          ))}
                        </DarkSelect>
                      </div>

                      <div className="md:col-span-2">
                        <FieldLabel htmlFor="city">
                          Ciudad / Municipio
                        </FieldLabel>
                        <DarkSelect
                          id="city"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          disabled={!stateCode || municipalitiesLoading || municipalities.length === 0}
                        >
                          <option value="" className="bg-[#0b0b0b] text-white">
                            {!stateCode
                              ? 'Primero selecciona un estado'
                              : municipalitiesLoading
                                ? 'Cargando municipios...'
                                : municipalities.length === 0
                                  ? 'No hay municipios disponibles'
                                  : 'Selecciona un municipio'}
                          </option>

                          {municipalities.map((municipality) => (
                            <option
                              key={municipality.code}
                              value={municipality.name}
                              className="bg-[#0b0b0b] text-white"
                            >
                              {municipality.name}
                            </option>
                          ))}
                        </DarkSelect>

                        {stateName && (
                          <p className="mt-2 text-xs text-white/45">
                            Estado seleccionado: {stateName}
                          </p>
                        )}
                      </div>

                      <div>
                        <FieldLabel htmlFor="colony">Colonia</FieldLabel>
                        <DarkInput
                          id="colony"
                          value={colony}
                          onChange={(e) => setColony(e.target.value)}
                          placeholder="Centro"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FieldLabel htmlFor="street">Calle</FieldLabel>
                        <DarkInput
                          id="street"
                          value={street}
                          onChange={(e) => setStreet(e.target.value)}
                          placeholder="Av. Ejemplo"
                          required
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="extNumber">Número exterior</FieldLabel>
                        <DarkInput
                          id="extNumber"
                          value={extNumber}
                          onChange={(e) => setExtNumber(e.target.value)}
                          placeholder="123"
                        />
                      </div>

                      <div>
                        <FieldLabel htmlFor="intNumber">Número interior</FieldLabel>
                        <DarkInput
                          id="intNumber"
                          value={intNumber}
                          onChange={(e) => setIntNumber(e.target.value)}
                          placeholder="Opcional"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FieldLabel htmlFor="reference">Referencia</FieldLabel>
                        <DarkInput
                          id="reference"
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          placeholder="Casa blanca, portón negro, frente al parque..."
                        />
                      </div>

                      <div className="md:col-span-2">
                        <FieldLabel>Información adicional</FieldLabel>
                        <DarkTextarea
                          value={furtherInformation}
                          onChange={(e) => setFurtherInformation(e.target.value)}
                          placeholder="Indicaciones extra para la entrega"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleQuoteShipping}
                      disabled={quoteLoading || municipalitiesLoading}
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
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.025]">
                <AccordionHeader
                  title="2. Pago con tarjeta"
                  subtitle={
                    selectedShippingOption
                      ? `Total a pagar: ${grandTotalFormatted}`
                      : 'Selecciona primero tu envío para continuar'
                  }
                  icon={<CreditCard className="h-4 w-4 text-white/80" />}
                  isOpen={openSection === 'payment'}
                  onClick={() => {
                    if (!selectedShippingOption) {
                      setOpenSection('shipping')
                      return
                    }
                    setOpenSection(openSection === 'payment' ? 'shipping' : 'payment')
                  }}
                  disabled={false}
                />

                {openSection === 'payment' && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                    {!selectedShippingOption ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/70">
                        Primero cotiza y elige una opción de envío.
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
                            <FieldLabel htmlFor="cardholderName">
                              Nombre del titular
                            </FieldLabel>
                            <DarkInput
                              id="cardholderName"
                              value={cardholderName}
                              onChange={(e) =>
                                setCardholderName(e.target.value.toUpperCase())
                              }
                              placeholder="COMO APARECE EN LA TARJETA"
                              required
                            />
                          </div>

                          <div>
                            <FieldLabel>Número de tarjeta</FieldLabel>
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
                              <FieldLabel>Expiración</FieldLabel>
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
                              <FieldLabel>CVC</FieldLabel>
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
              <div className="mt-4 flex gap-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={
                loading ||
                quoteLoading ||
                municipalitiesLoading ||
                !stripe ||
                !elements ||
                !selectedShippingOption
              }
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
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

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/45">
              <Lock className="h-4 w-4" />
              <span>Los datos sensibles de tarjeta los procesa Stripe</span>
            </div>

            <Link
              href="/"
              className="mt-4 block text-center text-sm text-white/55 transition-colors hover:text-white"
            >
              <ArrowLeft className="mr-1 inline h-4 w-4" />
              Seguir comprando
            </Link>
          </div>
        </form>
      </div>
    </>
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