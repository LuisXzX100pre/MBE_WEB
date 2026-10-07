/** Only these local destinations are accepted after login; no open redirects. */
export function communityReturnPath(value: string | null) {
  if (value === '/comunidad') return value
  if (!value || !(value === '/comunidad/acceso' || value.startsWith('/comunidad/acceso?'))) return null
  const url = new URL(value, 'https://mbe.local')
  if (url.pathname !== '/comunidad/acceso') return null
  const code = url.searchParams.get('code')?.trim().toUpperCase()
  return '/comunidad/acceso' + (code && /^[A-Z0-9-]{8,64}$/.test(code) ? '?code=' + encodeURIComponent(code) : '')
}
