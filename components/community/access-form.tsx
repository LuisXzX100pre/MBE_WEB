'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
export function AccessForm({ initialCode = '' }: { initialCode?: string }) {
  const router = useRouter(), sending = useRef(false)
  const [code, setCode] = useState(initialCode), [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function redeem(event: React.FormEvent) {
    event.preventDefault(); if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      const response = await fetch('/api/community/access/redeem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'No se pudo verificar el código.')
      router.replace('/comunidad'); router.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'No se pudo verificar el código.'); sending.current = false; setBusy(false) }
  }
  return <form onSubmit={redeem} className="max-w-md space-y-5" aria-busy={busy}>
    <label htmlFor="access-code" className="block text-xs uppercase tracking-[0.2em]">Código de acceso</label>
    <input id="access-code" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} required maxLength={64} value={code} disabled={busy}
      onChange={event => setCode(event.target.value)} className="w-full border border-white/20 bg-transparent px-4 py-4 text-base uppercase tracking-widest outline-none focus:border-white/70" />
    <button disabled={busy} className="w-full bg-[#761b2b] px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] transition-colors hover:bg-[#942338] disabled:opacity-40">{busy ? 'Verificando...' : 'Entrar'}</button>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <p className="text-xs leading-5 text-white/35">Si ya eres miembro, tu acceso se conserva. El código solo se necesita una vez.</p>
  </form>
}
