// app/registro/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { Eye, EyeOff, Loader2, ArrowRight, Check } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const passwordRequirements = [
    { label: 'Minimo 6 caracteres', valid: password.length >= 6 },
    { label: 'Las contrasenas coinciden', valid: password === confirmPassword && confirmPassword.length > 0 },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Las contrasenas no coinciden')
      return
    }

    if (password.length < 6) {
      setError('La contrasena debe tener al menos 6 caracteres')
      return
    }

    setLoading(true)

    const result = await register(username, password)

    setLoading(false)

    if (result.success) {
      router.push('/')
      router.refresh()
    } else {
      setError(result.error || 'Error al crear cuenta')
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Visual */}
      <div className="hidden lg:flex flex-1 bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="relative z-10 flex items-center justify-center w-full p-12">
          <div className="text-center max-w-lg">
            <h2 className="text-4xl font-bold mb-4">Unete a MBE</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Crea tu cuenta y accede a ofertas exclusivas
            </p>
            <ul className="text-left space-y-4">
              {[
                'Guarda tus productos favoritos',
                'Seguimiento de pedidos en tiempo real',
                'Acceso a ofertas exclusivas',
                'Proceso de compra mas rapido',
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
        {/* Decorative elements */}
        <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <Link href="/" className="inline-block mb-12">
            <Image
              src="/logo.png"
              alt="MBE Logo"
              width={120}
              height={48}
              className="object-contain h-12 w-auto"
            />
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Crear cuenta</h1>
            <p className="text-muted-foreground">
              Registrate para comenzar a comprar
            </p>
          </div>

          {/* Form */}
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
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Contrasena
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors pr-12"
                  placeholder="Crea una contrasena segura"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                Confirmar contrasena
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="Repite tu contrasena"
                required
                minLength={6}
              />
            </div>

            {/* Password requirements */}
            <div className="flex flex-wrap gap-3">
              {passwordRequirements.map((req, i) => (
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

          {/* Login link */}
          <p className="mt-8 text-center text-muted-foreground">
            Ya tienes cuenta?{' '}
            <Link
              href="/login"
              className="text-foreground font-medium hover:text-primary transition-colors"
            >
              Iniciar sesion
            </Link>
          </p>

          {/* Back to home */}
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
