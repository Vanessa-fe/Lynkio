// SIREN d'une entreprise, lu dans les mentions légales de son site.
// En France, tout site professionnel doit afficher le numéro d'immatriculation
// de la société (SIREN, SIRET ou RCS). Même logique côté application :
// src/lib/detectors/legal-id.ts.

import { fetchPublicPage } from './site-stack.ts'

// Pages où se trouvent les mentions légales, reconnues à leur lien
const LEGAL_LINK = /mentions?[-_ ]?l[ée]gales?|legal|cgv|cgu|conditions[-_ ]g[ée]n[ée]rales|informations[-_ ]l[ée]gales|imprint|a[-_ ]propos|qui[-_ ]sommes/i
const MAX_LEGAL_PAGES = 3

// « SIREN : 123 456 789 », « SIRET 123 456 789 00012 », « RCS Paris 123 456 789 »
const ID_PATTERNS: RegExp[] = [
  /\bsiren\b[^0-9]{0,20}(\d{3}[\s. ]?\d{3}[\s. ]?\d{3})\b/gi,
  /\bsiret\b[^0-9]{0,20}(\d{3}[\s. ]?\d{3}[\s. ]?\d{3})[\s. ]?\d{5}\b/gi,
  /\br\.?\s?c\.?\s?s\.?\b[^0-9]{0,40}(\d{3}[\s. ]?\d{3}[\s. ]?\d{3})\b/gi,
]

/**
 * Clé de contrôle d'un SIREN (algorithme de Luhn) : écarte les numéros
 * de téléphone ou de TVA mal découpés pris pour un SIREN
 */
export function isValidSiren(siren: string): boolean {
  if (!/^\d{9}$/.test(siren) || siren === '000000000') return false
  let sum = 0
  for (let index = 0; index < 9; index++) {
    let digit = Number(siren[8 - index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/\s+/g, ' ')
}

/**
 * Premier SIREN valide trouvé dans la page. Le plus fréquent l'emporte : un site
 * peut citer d'autres sociétés (hébergeur, agence), mais surtout la sienne.
 */
export function sirenFromHtml(html: string): string | null {
  const text = textOf(html)
  const counts = new Map<string, number>()

  for (const pattern of ID_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const siren = (match[1] ?? '').replace(/\D/g, '')
      if (isValidSiren(siren)) counts.set(siren, (counts.get(siren) ?? 0) + 1)
    }
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// Liens internes vers les pages légales, les plus probables d'abord
function legalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const links: { url: string; rank: number }[] = []

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = match[1] ?? ''
    const label = textOf(match[2] ?? '')
    if (!LEGAL_LINK.test(href) && !LEGAL_LINK.test(label)) continue

    try {
      const url = new URL(href, base)
      if (url.hostname !== base.hostname) continue
      const rank = /mentions?[-_ ]?l[ée]gales?|legal|informations[-_ ]l[ée]gales|imprint/i.test(`${href} ${label}`) ? 0 : 1
      links.push({ url: url.toString(), rank })
    } catch {
      // lien mal formé : ignoré
    }
  }

  return [...new Map(links.sort((a, b) => a.rank - b.rank).map((link) => [link.url, link])).keys()]
}

/**
 * SIREN affiché sur le site : page d'accueil (souvent dans le pied de page),
 * puis pages de mentions légales. null si aucun numéro valide n'est trouvé.
 */
export async function findSirenOnSite(homeUrl: string, homeHtml: string): Promise<string | null> {
  const fromHome = sirenFromHtml(homeHtml)
  if (fromHome) return fromHome

  for (const url of legalLinks(homeHtml, homeUrl).slice(0, MAX_LEGAL_PAGES)) {
    const page = await fetchPublicPage(url)
    const siren = page ? sirenFromHtml(page.html) : null
    if (siren) return siren
  }

  return null
}
