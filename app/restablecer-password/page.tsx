'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Check, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!token) {
      setError('El enlace no es válido o no contiene token')
      return
    }

    try {
      setLoading(true)

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'No se pudo restablecer la contraseña')
        return
      }

      setSuccess(data.message || 'Tu contraseña fue actualizada correctamente.')

      setTimeout(() => {
        router.push('/login?reset=1')
      }, 1200)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <Image
            src="/logo.png"
            alt="MBE Logo"
            width={120}
            height={48}
            className="object-contain h-12 w-auto mx-auto mb-8"
          />
          <h1 className="text-2xl font-bold mb-3">Enlace inválido</h1>
          <p className="text-muted-foreground mb-6">
            El enlace para restablecer la contraseña no es válido o está incompleto.
          </p>
          <Link
            href="/recuperar-password"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-primary-foreground"
          >
            Solicitar otro enlace
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
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
          <h1 className="text-3xl font-bold mb-2">Restablecer contraseña</h1>
          <p className="text-muted-foreground">
            Elige una nueva contraseña segura para tu cuenta
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors pr-12"
                placeholder="Crea una nueva contraseña"
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
              placeholder="Repite la nueva contraseña"
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

          {success && (
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-sm text-green-600">{success}</p>
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
                Actualizando...
              </>
            ) : (
              <>
                Guardar nueva contraseña
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center">
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Volver al login
          </Link>
        </div>
      </div>
    </div>
  )
}