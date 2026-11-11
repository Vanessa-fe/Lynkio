// Recherche sur Internet faite par Filonea (Tavily), pour les IA qui n'ont pas la leur (Mistral,
// DeepSeek, Groq, OpenRouter, Grok…) et pour Gemini sans la facturation Google. Les pages trouvées
// sont ensuite données à l'IA de l'utilisateur, qui n'a plus qu'à les lire.
//
// Clé de Filonea (secret TAVILY_API_KEY) : offre gratuite de 1 000 recherches par mois, partagée
// entre tous les comptes, d'où un plafond par compte (voir prospection-run/ai-research.ts).
// Seuls des mots de recherche partent chez Tavily (technologies, « PME France »…), jamais de
// données personnelles.

import { UserFacingError } from './errors.ts'

const TAVILY_URL = 'https://api.tavily.com/search'
const TIMEOUT_MS = 20_000
const RESULTS_PER_QUERY = 10
// Extrait gardé par page : assez pour reconnaître l'entreprise, sans noyer l'IA
const MAX_EXTRACT_LENGTH = 600

export type WebPage = { url: string; title: string; extract: string }

export const WEB_SEARCH_UNAVAILABLE_MESSAGE =
  'La recherche sur Internet n’est pas disponible pour le moment : réessayez plus tard.'

export function hasSharedWebSearch(): boolean {
  return !!Deno.env.get('TAVILY_API_KEY')
}

/**
 * Lance les recherches une par une et renvoie les pages trouvées, sans doublon. Une recherche qui
 * échoue n'empêche pas les autres ; si toutes échouent, l'erreur est expliquée.
 */
export async function searchWeb(queries: string[]): Promise<WebPage[]> {
  const key = Deno.env.get('TAVILY_API_KEY')
  if (!key) throw new UserFacingError(WEB_SEARCH_UNAVAILABLE_MESSAGE)

  const pages = new Map<string, WebPage>()
  let lastError: UserFacingError | null = null

  for (const query of queries) {
    let response: Response
    try {
      response = await fetch(TAVILY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          query,
          topic: 'general',
          search_depth: 'basic',
          max_results: RESULTS_PER_QUERY,
          country: 'france',
          include_answer: false,
          include_raw_content: false,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch (error) {
      console.error('web-search: Tavily injoignable', error instanceof Error ? error.message : error)
      lastError = new UserFacingError(WEB_SEARCH_UNAVAILABLE_MESSAGE)
      continue
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('web-search: Tavily', response.status, detail.slice(0, 300))
      // 432 / 433 : crédits du mois épuisés ; 429 : trop de demandes à la fois
      lastError = new UserFacingError(
        response.status === 432 || response.status === 433
          ? 'La recherche sur Internet de Filonea a atteint sa limite du mois : réessayez le mois prochain, ou utilisez une clé OpenAI, qui a sa propre recherche.'
          : WEB_SEARCH_UNAVAILABLE_MESSAGE
      )
      // Inutile d'insister : les recherches suivantes échoueraient de la même façon
      if (response.status === 401 || response.status === 432 || response.status === 433) break
      continue
    }

    const body = (await response.json().catch(() => null)) as { results?: { url?: string; title?: string; content?: string }[] } | null
    for (const result of body?.results ?? []) {
      if (!result.url || !/^https?:\/\//.test(result.url) || pages.has(result.url)) continue
      pages.set(result.url, {
        url: result.url,
        title: (result.title ?? '').trim(),
        extract: (result.content ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_EXTRACT_LENGTH),
      })
    }
  }

  if (pages.size === 0 && lastError) throw lastError
  return [...pages.values()]
}

/** Les pages trouvées, présentées à l'IA (numérotées, avec leur adresse exacte) */
export function formatPagesForAi(pages: WebPage[]): string {
  return pages.map((page, index) => `[${index + 1}] ${page.title}\nAdresse : ${page.url}\nExtrait : ${page.extract}`).join('\n\n')
}
