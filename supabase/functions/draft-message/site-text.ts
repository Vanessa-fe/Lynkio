// Ce que dit la page d'accueil d'une entreprise (titre, description, grands
// titres), pour que Sophie puisse parler de son activité sans rien inventer.
// Le code extrait le texte ; l'IA ne lit jamais le site elle-même.

import { fetchPublicPage } from '../prospection-run/site-stack.ts'

const MAX_HEADINGS = 8
const MAX_PART_LENGTH = 200
const MAX_TOTAL_LENGTH = 1500

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  ccedil: 'ç',
}

function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PART_LENGTH)
}

// Contenu d'une balise <meta>, quel que soit l'ordre de ses attributs
function metaContent(html: string, names: string[]): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase()
    if (!key || !names.includes(key)) continue
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1]
    if (content) return cleanText(content)
  }
  return null
}

/**
 * Résumé textuel de la page d'accueil, ou null si le site est injoignable
 */
export async function fetchSiteText(website: string): Promise<string | null> {
  const page = await fetchPublicPage(website)
  if (!page) return null

  // Les scripts et styles contiennent parfois des balises de titre dans des chaînes
  const html = page.html.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')

  const title = cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const description = metaContent(html, ['description', 'og:description'])
  const headings = [...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((match) => cleanText(match[1] ?? ''))
    .filter((text) => text.length > 2)

  const lines = [
    title ? `Titre : ${title}` : null,
    description ? `Description : ${description}` : null,
    ...[...new Set(headings)].slice(0, MAX_HEADINGS).map((heading) => `Titre de section : ${heading}`),
  ].filter((line): line is string => line !== null)

  return lines.length > 0 ? lines.join('\n').slice(0, MAX_TOTAL_LENGTH) : null
}
