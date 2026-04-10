'use client'

type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'unionpay'
  | 'unknown'

interface PaymentCardPreviewProps {
  cardholderName: string
  brand: CardBrand
  isCvcFocused: boolean
  numberComplete: boolean
  expiryComplete: boolean
  cvcComplete: boolean
}

function getBrandLabel(brand: CardBrand) {
  switch (brand) {
    case 'visa':
      return 'VISA'
    case 'mastercard':
      return 'MASTERCARD'
    case 'amex':
      return 'AMEX'
    case 'discover':
      return 'DISCOVER'
    case 'unionpay':
      return 'UNIONPAY'
    default:
      return 'CARD'
  }
}

function getThemeClasses(brand: CardBrand) {
  switch (brand) {
    case 'visa':
      return {
        front:
          'bg-[radial-gradient(circle_at_top_left,rgba(70,120,255,0.30),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(15,45,120,0.45),transparent_28%),linear-gradient(135deg,#0a1633_0%,#102a67_45%,#183f93_100%)]',
        back:
          'bg-[radial-gradient(circle_at_top_left,rgba(70,120,255,0.18),transparent_28%),linear-gradient(135deg,#081225_0%,#0c1e47_50%,#143678_100%)]',
        badge:
          'border-blue-300/20 bg-blue-400/10 text-blue-100',
        chip:
          'border-white/20 bg-white/10',
      }
    case 'mastercard':
      return {
        front:
          'bg-[radial-gradient(circle_at_top_left,rgba(255,98,0,0.25),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(225,20,0,0.22),transparent_26%),linear-gradient(135deg,#181818_0%,#111111_45%,#232323_100%)]',
        back:
          'bg-[radial-gradient(circle_at_top_left,rgba(255,98,0,0.16),transparent_28%),linear-gradient(135deg,#111111_0%,#080808_48%,#1a1a1a_100%)]',
        badge:
          'border-orange-300/20 bg-orange-400/10 text-orange-100',
        chip:
          'border-white/15 bg-white/10',
      }
    case 'amex':
      return {
        front:
          'bg-[radial-gradient(circle_at_top_left,rgba(58,197,255,0.28),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(0,120,215,0.22),transparent_30%),linear-gradient(135deg,#08212c_0%,#0f4761_48%,#13739e_100%)]',
        back:
          'bg-[radial-gradient(circle_at_top_left,rgba(58,197,255,0.18),transparent_28%),linear-gradient(135deg,#06161f_0%,#0b3447_45%,#106080_100%)]',
        badge:
          'border-cyan-300/20 bg-cyan-400/10 text-cyan-100',
        chip:
          'border-white/20 bg-white/10',
      }
    case 'discover':
      return {
        front:
          'bg-[radial-gradient(circle_at_top_left,rgba(255,132,0,0.25),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_26%),linear-gradient(135deg,#181818_0%,#101010_45%,#262626_100%)]',
        back:
          'bg-[radial-gradient(circle_at_top_left,rgba(255,132,0,0.16),transparent_28%),linear-gradient(135deg,#121212_0%,#090909_48%,#1f1f1f_100%)]',
        badge:
          'border-orange-300/20 bg-orange-400/10 text-orange-100',
        chip:
          'border-white/15 bg-white/10',
      }
    case 'unionpay':
      return {
        front:
          'bg-[radial-gradient(circle_at_top_left,rgba(0,180,120,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(220,30,30,0.18),transparent_26%),linear-gradient(135deg,#102216_0%,#111111_45%,#1f2f25_100%)]',
        back:
          'bg-[radial-gradient(circle_at_top_left,rgba(0,180,120,0.14),transparent_28%),linear-gradient(135deg,#0b140e_0%,#101010_48%,#1a241d_100%)]',
        badge:
          'border-emerald-300/20 bg-emerald-400/10 text-emerald-100',
        chip:
          'border-white/15 bg-white/10',
      }
    default:
      return {
        front:
          'bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_35%),linear-gradient(135deg,#171717_0%,#0a0a0a_45%,#1f1f1f_100%)]',
        back:
          'bg-[linear-gradient(135deg,#151515_0%,#050505_50%,#191919_100%)]',
        badge:
          'border-white/10 bg-white/10 text-white/80',
        chip:
          'border-white/15 bg-white/10',
      }
  }
}

function BrandMark({ brand }: { brand: CardBrand }) {
  if (brand === 'visa') {
    return (
      <div className="text-right">
        <div className="text-[22px] font-black italic tracking-tight text-white">
          VISA
        </div>
        <div className="text-[10px] uppercase tracking-[0.35em] text-white/45">
          MBE STORE
        </div>
      </div>
    )
  }

  if (brand === 'mastercard') {
    return (
      <div className="flex items-center gap-2">
        <div className="relative h-8 w-16">
          <span className="absolute left-0 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[#ea001b]/90 blur-[0.2px]" />
          <span className="absolute left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-[#ff9900]/90 blur-[0.2px]" />
        </div>
        <div className="text-right leading-none">
          <div className="text-[13px] font-bold tracking-[0.18em] text-white">
            MASTERCARD
          </div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.35em] text-white/45">
            MBE STORE
          </div>
        </div>
      </div>
    )
  }

  if (brand === 'amex') {
    return (
      <div className="text-right">
        <div className="rounded-md border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-[14px] font-bold tracking-[0.28em] text-cyan-100">
          AMEX
        </div>
        <div className="mt-1 text-[9px] uppercase tracking-[0.35em] text-white/45">
          MBE STORE
        </div>
      </div>
    )
  }

  if (brand === 'discover') {
    return (
      <div className="text-right">
        <div className="text-[16px] font-black tracking-[0.16em] text-white">
          DISCOVER
        </div>
        <div className="mt-1 h-[3px] w-full rounded-full bg-gradient-to-r from-orange-500 via-orange-300 to-transparent" />
        <div className="mt-1 text-[9px] uppercase tracking-[0.35em] text-white/45">
          MBE STORE
        </div>
      </div>
    )
  }

  if (brand === 'unionpay') {
    return (
      <div className="text-right">
        <div className="flex items-center justify-end gap-1">
          <span className="rounded-sm bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            U
          </span>
          <span className="rounded-sm bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            P
          </span>
        </div>
        <div className="mt-1 text-[12px] font-bold tracking-[0.24em] text-white">
          UNIONPAY
        </div>
      </div>
    )
  }

  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.35em] text-white/50">
        MBE STORE
      </div>
      <div className="mt-1 text-sm font-semibold tracking-[0.2em] text-white/70">
        CARD
      </div>
    </div>
  )
}

export function PaymentCardPreview({
  cardholderName,
  brand,
  isCvcFocused,
  numberComplete,
  expiryComplete,
  cvcComplete,
}: PaymentCardPreviewProps) {
  const displayName = cardholderName.trim() || 'NOMBRE DEL TITULAR'
  const label = getBrandLabel(brand)
  const theme = getThemeClasses(brand)

  return (
    <div className="relative h-60 w-full [perspective:1400px]">
      <div
        className={`relative h-full w-full rounded-[28px] transition-transform duration-700 [transform-style:preserve-3d] ${
          isCvcFocused ? '[transform:rotateY(180deg)]' : ''
        }`}
      >
        {/* Front */}
        <div
          className={`absolute inset-0 rounded-[28px] border border-white/10 ${theme.front} p-6 text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)] [backface-visibility:hidden] overflow-hidden`}
        >
          <div
            className={`absolute right-5 top-5 rounded-full border px-4 py-1.5 text-[10px] font-semibold tracking-[0.3em] ${theme.badge}`}
          >
            {label}
          </div>

          <div className="absolute inset-0 opacity-35">
            <div className="absolute -left-10 top-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
          </div>

          <div className="absolute inset-0 opacity-[0.07]">
            <div className="absolute left-6 top-6 h-[1px] w-24 bg-white" />
            <div className="absolute right-6 bottom-10 h-[1px] w-16 bg-white" />
            <div className="absolute bottom-6 left-10 h-20 w-20 rounded-full border border-white" />
          </div>

          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <div
                className={`h-12 w-16 rounded-xl border ${theme.chip} backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
              />
              <BrandMark brand={brand} />
            </div>

            <div className="space-y-5">
              <div className="font-mono text-2xl md:text-[30px] tracking-[0.22em] text-white/95">
                {numberComplete ? '•••• •••• •••• ••••' : '•••• •••• •••• ••••'}
              </div>

              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-white/45">
                    Cardholder
                  </p>
                  <p className="max-w-[220px] truncate text-sm font-medium tracking-[0.18em] text-white/90 uppercase">
                    {displayName}
                  </p>
                </div>

                <div className="text-right">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-white/45">
                    Expira
                  </p>
                  <p className="font-mono text-sm tracking-[0.2em] text-white/90">
                    {expiryComplete ? '••/••' : 'MM/YY'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  numberComplete ? 'bg-emerald-400' : 'bg-white/30'
                }`}
              />
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  expiryComplete ? 'bg-emerald-400' : 'bg-white/30'
                }`}
              />
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  cvcComplete ? 'bg-emerald-400' : 'bg-white/30'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Back */}
        <div
          className={`absolute inset-0 rounded-[28px] border border-white/10 ${theme.back} text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)] [transform:rotateY(180deg)] [backface-visibility:hidden] overflow-hidden`}
        >
          <div className="mt-8 h-12 w-full bg-white/90" />

          <div className="px-6 pt-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">
                Codigo de seguridad
              </p>
              <span className="text-[11px] font-semibold tracking-[0.25em] text-white/60">
                {label}
              </span>
            </div>

            <div className="mt-2 flex h-12 items-center justify-end rounded-xl bg-white px-4 font-mono text-lg tracking-[0.3em] text-black">
              {cvcComplete ? '•••' : '•••'}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.25em] text-white/35">
                Secure Payment
              </div>
              <BrandMark brand={brand} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}