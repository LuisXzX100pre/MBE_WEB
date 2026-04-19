'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Eye, EyeOff, Loader2, ArrowRight, Check } from 'lucide-react'

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidUsername(username: string) {
  return /^[a-zA-Z0-9._-]{3,24}$/.test(username)
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordChecks = useMemo(
    () => [
      { label: 'Mínimo 8 caracteres', valid: password.length >= 8 },
      { label: 'Una mayúscula', valid: /[A-Z]/.test(password) },
      { label: 'Una minúscula', valid: /[a-z]/.test(password) },
      { label: 'Un número', valid: /\d/.test(password) },
      { label: 'Un símbolo', valid: /[^A-Za-z\d]/.test(password) },
      {
        label: 'Las contraseñas coinciden',
        valid: password === confirmPassword && confirmPassword.length > 0,
      },
    ],
    [password, confirmPassword]
  )

  const isPasswordStrong =
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z\d]/.test(password)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanUsername = username.trim()
    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = normalizePhone(phone)

    if (!cleanUsername || !cleanEmail || !cleanPhone || !password || !confirmPassword) {
      setError('Completa todos los campos')
      return
    }

    if (!isValidUsername(cleanUsername)) {
      setError(
        'El usuario debe tener entre 3 y 24 caracteres y solo puede incluir letras, números, punto, guion o guion bajo'
      )
      return
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Ingresa un correo válido')
      return
    }

    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      setError('Ingresa un teléfono válido')
      return
    }

    if (!isPasswordStrong) {
      setError(
        'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un símbolo'
      )
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    const result = await register({
      username: cleanUsername,
      email: cleanEmail,
      phone: cleanPhone,
      password,
    })

    setLoading(false)

    if (result.success) {
      router.push('/login?registered=1')
      router.refresh()
    } else {
      setError(result.error || 'Error al crear cuenta')
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-1 bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="relative z-10 flex items-center justify-center w-full p-12">
          <div className="text-center max-w-lg">
            <h2 className="text-4xl font-bold mb-4">Únete a MBE</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Crea tu cuenta y accede a una experiencia de compra más formal y completa
            </p>

            <ul className="text-left space-y-4">
              {[
                'Guarda tu cuenta con correo y teléfono',
                'Seguimiento de pedidos en tiempo real',
                'Acceso más rápido al checkout',
                'Inicio de sesión con usuario o correo',
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-primary" />
                  </div>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="inline-block mb-12">
            <Image
              src="/logo.png"
              alt="MBE Logo"
              width={120}
              height={48}
              className="object-contain h-12 w-auto"
            />
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Crear cuenta</h1>
            <p className="text-muted-foreground">
              Regístrate con tus datos para comenzar a comprar
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="Elige un nombre de usuario"
                autoComplete="username"
                required
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Usa entre 3 y 24 caracteres. Puedes incluir letras, números, punto, guion y guion bajo.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Teléfono
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="9981234567"
                autoComplete="tel"
                inputMode="numeric"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors pr-12"
                  placeholder="Crea una contraseña segura"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Confirmar contraseña
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="Repite tu contraseña"
                autoComplete="new-password"
                required
              />
            </div>

            <div className="flex flex-wrap gap-3">
              {passwordChecks.map((req, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 text-xs ${
                    req.valid ? 'text-green-500' : 'text-muted-foreground'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                      req.valid
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-muted-foreground/30'
                    }`}
                  >
                    {req.valid && <Check className="w-3 h-3" />}
                  </div>
                  {req.label}
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                <>
                  Crear cuenta
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link
              href="/login"
              className="text-foreground font-medium hover:text-primary transition-colors"
            >
              Iniciar sesión
            </Link>
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            Volver a la tienda
          </Link>
        </div>
      </div>
    </div>
  )
}