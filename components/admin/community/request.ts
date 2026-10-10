export async function communityRequest<T>(url: string, method = 'GET', data?: unknown): Promise<T> {
  const res = await fetch(url, { method, ...(data !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}), cache: 'no-store' })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'No se pudo completar la solicitud')
  return result as T
}
export const field = 'w-full border border-white/15 bg-black/30 px-4 py-3 text-sm outline-none focus:border-white/60'
export const action = 'border border-white/25 px-5 py-3 text-xs uppercase tracking-widest hover:bg-white/10 disabled:opacity-40'
