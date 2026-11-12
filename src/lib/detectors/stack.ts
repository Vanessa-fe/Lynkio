import 'server-only'
import { publicPage, PublicPageError as StackDetectionError } from '../../../supabase/functions/_shared/public-page'
import type { DetectableTechnology } from '@/lib/constants/technologies'

/**
 * Détection de la stack technique d'un site, à partir du HTML de sa page d'accueil.
 * Utilisée par la route /api/companies/detect-stack (formulaire) et par l'action
 * « Analyser le site » de la fiche entreprise.
 */

const STACK_MARKERS: Record<string, string[]> = {
  nextjs: ['/_next/static/', '__NEXT_DATA__', 'self.__next_f'],
  wordpress: ['wp-content', 'wp-includes'],
  webflow: ['data-wf-site', 'webflow.js'],
}

export { StackDetectionError }

export type StackDetectionResult = {
  url: string
  detected: DetectableTechnology[]
  evidence: Record<string, string[]>
  checkedAt: string
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
    const { html } = await publicPage(rawUrl)
    return html
  } catch {
    return null
  }
}

/**
 * Analyse de la page d'accueil, avec son HTML (réutilisé pour y chercher le SIREN)
 */
export async function analyzeSite(rawUrl: string): Promise<StackDetectionResult & { html: string }> {
  const { finalUrl, html } = await publicPage(rawUrl)
  return { url: finalUrl.toString(), ...detectFromHtml(html), checkedAt: new Date().toISOString(), html }
}
