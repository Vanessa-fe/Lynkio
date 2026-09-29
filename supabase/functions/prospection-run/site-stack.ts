// Technologies d'un site, repérées dans le HTML de sa page d'accueil.
// Mêmes marqueurs que la détection de l'application (src/lib/detectors/stack.ts).

const FETCH_TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 1_500_000
const USER_AGENT = 'ProspectCRM-StackDetector/1.0'

const MARKERS: Record<string, (html: string) => boolean> = {
  nextjs: (html) => ['/_next/static/', '__NEXT_DATA__', 'self.__next_f'].some((marker) => html.includes(marker)),
  react: (html) => html.includes('data-reactroot') || /<script[^>]+src=["'][^"']*react-dom[^"']*["']/i.test(html),
  wordpress: (html) =>
    html.includes('wp-content') || html.includes('wp-includes') || /<meta\s+name=["']generator["']\s+content=["']WordPress/i.test(html),
  webflow: (html) => html.includes('data-wf-site') || html.includes('webflow.js'),
}

// Adresses à ne jamais appeler : réseau local, adresses IP brutes, noms internes
function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (!host.includes('.') || host === 'localhost' || /\.(local|internal|localhost)$/.test(host)) return false
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) return false
  return true
}

async function readBounded(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    size += value.byteLength
    if (size >= MAX_HTML_BYTES) {
      await reader.cancel().catch(() => {})
      break
    }
  }
  const merged = new Uint8Array(Math.min(size, MAX_HTML_BYTES))
  let offset = 0
  for (const chunk of chunks) {
    const part = chunk.subarray(0, merged.length - offset)
    merged.set(part, offset)
    offset += part.length
    if (offset >= merged.length) break
  }
  return new TextDecoder('utf-8').decode(merged)
}

/**
 * HTML d'une page publique (après redirections), ou null si elle est injoignable
 */
export async function fetchPublicPage(rawUrl: string): Promise<{ finalUrl: string; html: string } | null> {
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
  } catch {
    return null
  }
  if (!isPublicHost(url.hostname)) return null

  try {
    const response = await fetch(url.toString(), {
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const finalUrl = new URL(response.url || url.toString())
    if (!response.ok || !isPublicHost(finalUrl.hostname)) {
      await response.body?.cancel().catch(() => {})
      return null
    }
    return { finalUrl: finalUrl.toString(), html: await readBounded(response) }
  } catch {
    return null
  }
}

/**
 * Technologies détectées sur la page d'accueil, ou null si le site est injoignable.
 * finalUrl : l'adresse du site après redirections (celle à enregistrer) ;
 * html : la page, réutilisée pour y chercher le SIREN.
 */
export async function detectSiteStack(
  rawUrl: string
): Promise<{ finalUrl: string; detected: string[]; html: string } | null> {
  const page = await fetchPublicPage(rawUrl)
  if (!page) return null

  const detected = Object.entries(MARKERS)
    .filter(([, matches]) => matches(page.html))
    .map(([technology]) => technology)
  return { finalUrl: `${new URL(page.finalUrl).origin}/`, detected, html: page.html }
}
