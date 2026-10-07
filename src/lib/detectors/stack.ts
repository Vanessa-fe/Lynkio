import 'server-only'
import dns from 'dns'
import { isPrivateIp } from '@/lib/utils/ip'
import type { DetectableTechnology } from '@/lib/constants/technologies'

/**
 * Détection de la stack technique d'un site, à partir du HTML de sa page d'accueil.
 * Utilisée par la route /api/companies/detect-stack (formulaire) et par l'action
 * « Analyser le site » de la fiche entreprise.
 */

const FETCH_TIMEOUT_MS = 5000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // ~2 Mo
const MAX_REDIRECTS = 3
const USER_AGENT = 'Filonea-StackDetector/1.0'

const STACK_MARKERS: Record<string, string[]> = {
  nextjs: ['/_next/static/', '__NEXT_DATA__', 'self.__next_f'],
  wordpress: ['wp-content', 'wp-includes'],
  webflow: ['data-wf-site', 'webflow.js'],
}

export class StackDetectionError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
  }
}

export type StackDetectionResult = {
  url: string
  detected: DetectableTechnology[]
  evidence: Record<string, string[]>
  checkedAt: string
}

/**
 * Lit un ReadableStream en le plafonnant à `maxBytes`, pour éviter qu'une
 * page anormalement lourde bloque ou sature la mémoire du serveur.
 */
async function readBounded(body: ReadableStream<Uint8Array>, maxBytes: number): Promise<string> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      chunks.push(value)
      if (received >= maxBytes) {
        await reader.cancel().catch(() => {})
        break
      }
    }
  }

  const totalLength = Math.min(received, maxBytes)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    const remaining = totalLength - offset
    if (remaining <= 0) break
    const slice = chunk.byteLength > remaining ? chunk.subarray(0, remaining) : chunk
    merged.set(slice, offset)
    offset += slice.byteLength
  }

  return new TextDecoder('utf-8').decode(merged)
}

/**
 * Garde-fou SSRF : l'adresse doit être publique (pas le réseau interne du
 * serveur, ni l'adresse de métadonnées du cloud). Vérifié à chaque étape d'une
 * redirection : un site public pourrait sinon rediriger vers une adresse interne.
 */
async function assertPublicUrl(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new StackDetectionError('Seuls les protocoles http et https sont autorisés', 400)
  }

  let addresses: string[]
  try {
    const results = await dns.promises.lookup(url.hostname, { all: true })
    addresses = results.map((result) => result.address)
  } catch {
    throw new StackDetectionError('Impossible de résoudre cette adresse', 400)
  }

  if (addresses.length === 0 || addresses.some((address) => isPrivateIp(address))) {
    throw new StackDetectionError('Cette adresse n\'est pas autorisée', 403)
  }
}

/**
 * Récupère le HTML en suivant les redirections à la main (au plus MAX_REDIRECTS),
 * pour revérifier chaque adresse de destination
 */
async function fetchHtml(startUrl: URL): Promise<{ finalUrl: URL; html: string }> {
  let url = startUrl

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url)

    let response: Response
    try {
      response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'manual',
      })
    } catch {
      throw new StackDetectionError(
        'Impossible de récupérer la page (délai dépassé ou site injoignable)',
        502
      )
    }

    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => {})
      url = new URL(location, url)
      continue
    }

    if (!response.ok || !response.body) {
      throw new StackDetectionError('Impossible de récupérer la page (réponse invalide)', 502)
    }

    return { finalUrl: url, html: await readBounded(response.body, MAX_RESPONSE_BYTES) }
  }

  throw new StackDetectionError('Trop de redirections', 502)
}

function detectFromHtml(html: string) {
  const detected: DetectableTechnology[] = []
  const evidence: Record<string, string[]> = {}

  // Next.js
  const nextjsMatches = STACK_MARKERS.nextjs?.filter((marker) => html.includes(marker)) ?? []
  if (nextjsMatches.length > 0) {
    detected.push('nextjs')
    evidence.nextjs = nextjsMatches
  }

  // React (hors Next.js) : data-reactroot, ou un <script> référençant react-dom
  const reactMatches: string[] = []
  if (html.includes('data-reactroot')) reactMatches.push('data-reactroot')
  if (/<script[^>]+src=["'][^"']*react-dom[^"']*["']/i.test(html)) {
    reactMatches.push('script src contenant react-dom')
  }
  if (reactMatches.length > 0) {
    detected.push('react')
    evidence.react = reactMatches
  }

  // WordPress
  const wpMatches = STACK_MARKERS.wordpress?.filter((marker) => html.includes(marker)) ?? []
  if (/<meta\s+name=["']generator["']\s+content=["']WordPress/i.test(html)) {
    wpMatches.push('meta generator WordPress')
  }
  if (wpMatches.length > 0) {
    detected.push('wordpress')
    evidence.wordpress = wpMatches
  }

  // Webflow
  const webflowMatches = STACK_MARKERS.webflow?.filter((marker) => html.includes(marker)) ?? []
  if (/<meta\s+name=["']generator["']\s+content=["']Webflow/i.test(html)) {
    webflowMatches.push('meta generator Webflow')
  }
  if (webflowMatches.length > 0) {
    detected.push('webflow')
    evidence.webflow = webflowMatches
  }

  return { detected, evidence }
}

export async function detectStack(rawUrl: string): Promise<StackDetectionResult> {
  // Sans le HTML : ce résultat est renvoyé tel quel au navigateur (route detect-stack)
  const { url, detected, evidence, checkedAt } = await analyzeSite(rawUrl)
  return { url, detected, evidence, checkedAt }
}

/**
 * HTML d'une page publique (mêmes garde-fous que l'analyse), ou null si elle est
 * injoignable : sert à lire les pages de mentions légales
 */
export async function fetchPageHtml(rawUrl: string): Promise<string | null> {
  try {
    const { html } = await fetchHtml(new URL(rawUrl))
    return html
  } catch {
    return null
  }
}

/**
 * Analyse de la page d'accueil, avec son HTML (réutilisé pour y chercher le SIREN)
 */
export async function analyzeSite(rawUrl: string): Promise<StackDetectionResult & { html: string }> {
  // Une adresse sans protocole (« exemple.fr ») est complétée en https ;
  // un autre protocole explicite (ftp://, file://…) est refusé
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) && !/^https?:\/\//i.test(rawUrl)) {
    throw new StackDetectionError('Seuls les protocoles http et https sont autorisés', 400)
  }

  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
  } catch {
    throw new StackDetectionError('L\'URL n\'est pas valide', 400)
  }

  const { finalUrl, html } = await fetchHtml(url)
  return { url: finalUrl.toString(), ...detectFromHtml(html), checkedAt: new Date().toISOString(), html }
}
