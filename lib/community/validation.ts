export class CommunityError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export function text(value: unknown, label: string, max: number) {
  if (typeof value !== 'string') throw new CommunityError(label + ' es requerido')
  const clean = value.trim().normalize('NFC')
  if (!clean || clean.length > max || /[<>\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)) throw new CommunityError(label + ': usa texto plano de 1 a ' + max + ' caracteres')
  return clean
}
export function flag(value: unknown) {
  if (typeof value !== 'boolean') throw new CommunityError('Estado invalido')
  return value
}
export function date(value: unknown, optional = false): Date | null {
  if (optional && (value === null || value === undefined || value === '')) return null
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new CommunityError('Fecha invalida')
  return new Date(value)
}
export function period(startsAt: Date | null, endsAt: Date | null) {
  if (startsAt && endsAt && endsAt <= startsAt) throw new CommunityError('El fin debe ser posterior al inicio')
}
export async function body(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text()
  if (raw.length > 32000) throw new CommunityError('Solicitud demasiado grande', 413)
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error()
    return value as Record<string, unknown>
  } catch { throw new CommunityError('JSON invalido') }
}
