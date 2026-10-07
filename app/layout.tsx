import type { Metadata } from 'next'
import { Inter, Space_Mono } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { CartProvider } from '@/contexts/cart-context'
import { Toaster } from '@/components/ui/toaster'
import { AudioUnlockProvider } from '@/components/audio-unlock-provider'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
})

export const metadata: Metadata = {
  title: 'Sitio web oficial de MBE',
  description: 'Sitio web oficial de MBE. Streetwear, drops exclusivos y acceso a MBE Community',
  openGraph: {
    title: 'Sitio web oficial de MBE',
    description: 'Sitio web oficial de MBE. Streetwear, drops exclusivos y acceso a MBE Community',
    siteName: 'MBE',
    type: 'website',
    locale: 'es_MX',
  },
  icons: {
    icon: '/ICONO_LOGO.png',
    shortcut: '/ICONO_LOGO.png',
    apple: '/ICONO_LOGO.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${spaceMono.variable} font-sans antialiased`}>
        <AudioUnlockProvider />

        <AuthProvider>
          <CartProvider>
            {children}
            <Toaster />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}