// Adresse d'API acceptée pour « Autre IA » : https, un vrai nom de domaine (pas d'adresse IP ni de nom
// local), sans identifiants ni port inhabituel. Même règle que supabase/functions/_shared/ai.ts.
export function isSafeApiBaseUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    (url.port === '' || url.port === '443') &&
    host.includes('.') &&
    !/^[\d.]+$/.test(host) &&
    !host.includes(':') &&
    !/(^|\.)(localhost|local|internal|intranet|lan|home|corp|supabase\.co|supabase\.in)$/.test(host) &&
    /^\/[A-Za-z0-9._~/-]*$/.test(url.pathname) &&
    !url.search &&
    !url.hash
  )
}
