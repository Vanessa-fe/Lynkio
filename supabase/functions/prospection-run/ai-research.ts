// Recherche web par IA (avec la clé de l'utilisateur, voir _shared/ai.ts) des
// entreprises dont le site utilise une technologie donnée.
//
// Qui cherche sur Internet : OpenAI avec sa propre recherche ; Gemini avec celle de Google si la
// facturation est activée ; sinon, et pour toutes les autres IA, Filonea cherche lui-même
// (_shared/web-search.ts) et donne les pages trouvées à l'IA de l'utilisateur.
//
// L'IA propose, Sophie vérifie : chaque site est ensuite analysé par
// site-stack.ts, et une entreprise dont la technologie n'est pas confirmée
// dans le code de son site est écartée.

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateJson, normalizeUrl, type AiAccess } from '../_shared/ai.ts'
import { NoNativeWebSearchError, UserFacingError } from '../_shared/errors.ts'
import { formatPagesForAi, hasSharedWebSearch, searchWeb, type WebPage } from '../_shared/web-search.ts'
// Une recherche web prend souvent une minute : au-delà de deux, on abandonne
const REQUEST_TIMEOUT_MS = 120_000
// Domaines déjà suivis transmis à l'IA pour qu'elle ne les propose pas
const MAX_EXCLUDED_DOMAINS = 150
// Recherche de Filonea (crédits gratuits partagés entre tous les comptes) : par compte et par jour
const MAX_SHARED_SEARCHES_PER_DAY = 3

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

function prompt(technologies: string[], count: number, excludedDomains: string[], pages?: WebPage[]): string {
  const techList = technologies.join(' ou ')
  return `Tu aides une développeuse web freelance (${techList}), qui travaille uniquement à distance, à trouver des clients directs.

${
  pages
    ? `Voici des pages trouvées par une recherche sur Internet. En t'appuyant uniquement sur elles, trouve jusqu'à ${count} entreprises françaises réelles dont le propre site internet est développé avec ${techList}.`
    : `Recherche sur le web jusqu'à ${count} entreprises françaises réelles dont le propre site internet est développé avec ${techList}.`
}

Entreprises recherchées :
- PME françaises de 10 à 250 salariés : elles ont le budget d'une mission freelance ;
- jamais d'indépendants, d'auto-entrepreneurs, d'artisans ou de commerçants qui travaillent seuls, même si leur site convient ;
- de préférence des entreprises dont le métier n'est pas le numérique (commerce, e-commerce, services, industrie, santé, tourisme, immobilier, associations…) : elles dépendent d'un prestataire pour faire évoluer leur site.

À exclure absolument : agences web ou digitales, ESN, sociétés de conseil informatique, studios de développement, cabinets de recrutement, plateformes de freelances, éditeurs d'outils pour développeurs, grands groupes, filiales de grands groupes.
${excludedDomains.length > 0 ? `\nDéjà connues, à ne pas proposer : ${excludedDomains.join(', ')}.\n` : ''}
${
  pages
    ? ''
    : `Pistes de recherche : études de cas et références d'agences (« nous avons réalisé le site de … en ${techList} »), vitrines officielles de la technologie, annonces de lancement ou de refonte de site, pages « à propos » ou articles techniques d'entreprises.
`
}
Pour chaque entreprise :
- name : nom de l'entreprise ;
- website : adresse de SON site (pas celle de l'agence ni de l'article) ;
- city : ville, ou chaîne vide si inconnue ;
- activity : son activité, en quelques mots ;
- evidence : en une phrase, pourquoi on pense que son site utilise ${techList} ;
- sourceUrl : ${pages ? 'l\'adresse exacte, recopiée de la liste, de la page qui l\'indique' : 'l\'adresse exacte d\'une page réellement consultée qui l\'indique'}.

N'invente jamais d'entreprise, de site ni de source. Mieux vaut moins de résultats que des résultats douteux. Réponds en français, strictement au format JSON demandé.${
    pages ? `\n\nPages trouvées :\n\n${formatPagesForAi(pages)}` : ''
  }`
}

// Recherches lancées par Filonea quand l'IA n'a pas la sienne
function searchQueries(technologies: string[]): string[] {
  const techList = technologies.join(' ou ')
  return [
    `étude de cas site internet réalisé en ${techList} pour une PME française`,
    `agence web références clients refonte de site ${techList} entreprise France`,
    `nouveau site internet développé avec ${techList} PME française lancement`,
  ]
}

/**
 * Entreprises candidates, telles que proposées par l'IA (à vérifier ensuite).
 * Une source que la recherche n'a pas réellement consultée est retirée.
 */
export async function findCompaniesUsingTech(
  admin: SupabaseClient,
  userId: string,
  access: AiAccess,
  technologies: string[],
  count: number,
  excludedDomains: string[]
): Promise<TechCandidate[]> {
  const excluded = excludedDomains.slice(0, MAX_EXCLUDED_DOMAINS)

  // OpenAI et Gemini (facturation Google activée) : leur propre recherche sur Internet
  if (access.provider !== 'custom') {
    try {
      return await nativeSearch(access, technologies, count, excluded)
    } catch (error) {
      // Gemini sans la facturation Google : la recherche de Filonea prend le relais
      if (!(error instanceof NoNativeWebSearchError) || !hasSharedWebSearch()) throw error
    }
  } else if (!hasSharedWebSearch()) {
    throw new NoNativeWebSearchError(
      'La recherche sur le web n\'est possible qu\'avec une clé OpenAI, ou Gemini avec la facturation Google : ajoutez-en une dans Paramètres > Vos clés.'
    )
  }

  return sharedSearch(admin, userId, access, technologies, count, excluded)
}

async function nativeSearch(access: AiAccess, technologies: string[], count: number, excluded: string[]): Promise<TechCandidate[]> {
  const { text, consultedUrls } = await generateJson({
    access,
    name: 'tech_companies',
    schema: schema(count),
    input: prompt(technologies, count, excluded),
    webSearch: true,
    timeoutMs: REQUEST_TIMEOUT_MS,
    task: 'La recherche IA',
  })
  return toCandidates(text, consultedUrls)
}

// Filonea cherche sur Internet, puis l'IA de l'utilisateur lit les pages trouvées
async function sharedSearch(
  admin: SupabaseClient,
  userId: string,
  access: AiAccess,
  technologies: string[],
  count: number,
  excluded: string[]
): Promise<TechCandidate[]> {
  const { data: allowed, error } = await admin.rpc('hit_rate_limit', {
    p_bucket: `shared_web_search:${userId}`,
    p_max: MAX_SHARED_SEARCHES_PER_DAY,
    p_window_seconds: 86_400,
  })
  if (error) console.error('shared web search: limite illisible', error.message)
  if (allowed === false) {
    throw new UserFacingError(
      `Avec votre IA, la recherche par technologie est limitée à ${MAX_SHARED_SEARCHES_PER_DAY} par jour : réessayez demain (sans limite avec une clé OpenAI).`
    )
  }

  const pages = await searchWeb(searchQueries(technologies))
  if (pages.length === 0) return []

  const { text } = await generateJson({
    access,
    name: 'tech_companies',
    schema: schema(count),
    input: prompt(technologies, count, excluded, pages),
    timeoutMs: REQUEST_TIMEOUT_MS,
    task: 'La recherche IA',
  })
  return toCandidates(text, new Set(pages.map((page) => normalizeUrl(page.url))))
}

function toCandidates(text: string, consulted: Set<string>): TechCandidate[] {
  if (!text) return []

  const parsed = JSON.parse(text) as { companies?: TechCandidate[] }

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
