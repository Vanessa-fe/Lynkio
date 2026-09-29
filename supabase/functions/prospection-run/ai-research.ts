// Recherche web par IA (API Responses d'OpenAI, outil web_search) des
// entreprises dont le site utilise une technologie donnée.
//
// L'IA propose, Sophie vérifie : chaque site est ensuite analysé par
// site-stack.ts, et une entreprise dont la technologie n'est pas confirmée
// dans le code de son site est écartée. La clé est dans les secrets Supabase
// (OPENAI_API_KEY) ; le modèle peut être changé avec OPENAI_MODEL.

import { UserFacingError } from './context.ts'

const RESPONSES_URL = 'https://api.openai.com/v1/responses'
const DEFAULT_MODEL = 'gpt-5.6-terra'
// Une recherche web prend souvent une minute : au-delà de deux, on abandonne
const REQUEST_TIMEOUT_MS = 120_000
// Domaines déjà suivis transmis à l'IA pour qu'elle ne les propose pas
const MAX_EXCLUDED_DOMAINS = 150

export type TechCandidate = {
  name: string
  website: string
  city: string
  activity: string
  evidence: string
  sourceUrl: string | null
}

const schema = (count: number) => ({
  type: 'object',
  additionalProperties: false,
  required: ['companies'],
  properties: {
    companies: {
      type: 'array',
      maxItems: count,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'website', 'city', 'activity', 'evidence', 'sourceUrl'],
        properties: {
          name: { type: 'string' },
          website: { type: 'string' },
          city: { type: 'string' },
          activity: { type: 'string' },
          evidence: { type: 'string' },
          sourceUrl: { type: 'string' },
        },
      },
    },
  },
})

function prompt(technologies: string[], count: number, excludedDomains: string[]): string {
  const techList = technologies.join(' ou ')
  return `Tu aides une développeuse web freelance (${techList}), qui travaille uniquement à distance, à trouver des clients directs.

Recherche sur le web jusqu'à ${count} entreprises françaises réelles dont le propre site internet est développé avec ${techList}.

Entreprises recherchées :
- TPE ou PME (moins de 250 salariés), en France ;
- de préférence des entreprises dont le métier n'est pas le numérique (commerce, e-commerce, services, industrie, santé, tourisme, immobilier, associations…) : elles dépendent d'un prestataire pour faire évoluer leur site.

À exclure absolument : agences web ou digitales, ESN, sociétés de conseil informatique, studios de développement, cabinets de recrutement, plateformes de freelances, éditeurs d'outils pour développeurs, grands groupes, filiales de grands groupes.
${excludedDomains.length > 0 ? `\nDéjà connues, à ne pas proposer : ${excludedDomains.join(', ')}.\n` : ''}
Pistes de recherche : études de cas et références d'agences (« nous avons réalisé le site de … en ${techList} »), vitrines officielles de la technologie, annonces de lancement ou de refonte de site, pages « à propos » ou articles techniques d'entreprises.

Pour chaque entreprise :
- name : nom de l'entreprise ;
- website : adresse de SON site (pas celle de l'agence ni de l'article) ;
- city : ville, ou chaîne vide si inconnue ;
- activity : son activité, en quelques mots ;
- evidence : en une phrase, pourquoi on pense que son site utilise ${techList} ;
- sourceUrl : l'adresse exacte d'une page réellement consultée qui l'indique.

N'invente jamais d'entreprise, de site ni de source. Mieux vaut moins de résultats que des résultats douteux. Réponds en français, strictement au format JSON demandé.`
}

// Pages réellement consultées par la recherche web (citations et sources de l'outil)
function consultedUrls(response: { output?: unknown[] }): Set<string> {
  const urls = new Set<string>()
  for (const item of response.output ?? []) {
    const entry = item as {
      action?: { sources?: { url?: string }[] }
      content?: { annotations?: { type?: string; url?: string }[] }[]
    }
    for (const source of entry.action?.sources ?? []) if (source.url) urls.add(normalizeUrl(source.url))
    for (const block of entry.content ?? []) {
      for (const annotation of block.annotations ?? []) {
        if (annotation.type === 'url_citation' && annotation.url) urls.add(normalizeUrl(annotation.url))
      }
    }
  }
  return urls
}

function normalizeUrl(url: string): string {
  return url.trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
}

function outputText(response: { output_text?: string; output?: unknown[] }): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text
  return (response.output ?? [])
    .flatMap((item) => (item as { content?: { text?: string }[] }).content ?? [])
    .map((block) => block.text)
    .filter((text): text is string => typeof text === 'string')
    .join('\n')
}

/**
 * Entreprises candidates, telles que proposées par l'IA (à vérifier ensuite).
 * Une source que la recherche n'a pas réellement consultée est retirée.
 */
export async function findCompaniesUsingTech(
  technologies: string[],
  count: number,
  excludedDomains: string[]
): Promise<TechCandidate[]> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new UserFacingError('La clé OpenAI n\'est pas encore enregistrée sur Supabase')
  }

  let response: Response
  try {
    response = await fetch(RESPONSES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL,
        reasoning: { effort: 'low' },
        tools: [{ type: 'web_search', search_context_size: 'medium' }],
        include: ['web_search_call.action.sources'],
        input: prompt(technologies, count, excludedDomains.slice(0, MAX_EXCLUDED_DOMAINS)),
        text: { format: { type: 'json_schema', name: 'tech_companies', strict: true, schema: schema(count) } },
        store: false,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new UserFacingError('La recherche IA a pris trop de temps : réessayez dans un instant')
    }
    throw error
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    if (response.status === 401) throw new UserFacingError('OpenAI refuse la clé enregistrée sur Supabase')
    if (response.status === 429) {
      throw new UserFacingError('Quota ou crédit OpenAI épuisé : vérifiez votre compte OpenAI')
    }
    throw new Error(`Recherche IA impossible (HTTP ${response.status}) ${detail.slice(0, 200)}`)
  }

  const body = (await response.json()) as { output_text?: string; output?: unknown[] }
  const text = outputText(body)
  if (!text) return []

  const parsed = JSON.parse(text) as { companies?: TechCandidate[] }
  const consulted = consultedUrls(body)

  return (parsed.companies ?? [])
    .filter((candidate) => candidate.name?.trim() && candidate.website?.trim())
    .map((candidate) => ({
      name: candidate.name.trim(),
      website: candidate.website.trim(),
      city: candidate.city?.trim() ?? '',
      activity: candidate.activity?.trim() ?? '',
      evidence: candidate.evidence?.trim() ?? '',
      sourceUrl: candidate.sourceUrl && consulted.has(normalizeUrl(candidate.sourceUrl)) ? candidate.sourceUrl : null,
    }))
}
