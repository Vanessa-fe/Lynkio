// Recherche web par IA (avec la clé de l'utilisateur et la recherche sur Internet de son IA :
// OpenAI, Gemini ou Claude, voir _shared/ai.ts) des entreprises dont le site utilise une
// technologie donnée.
//
// L'IA propose, Sophie vérifie : chaque site est ensuite analysé par
// site-stack.ts, et une entreprise dont la technologie n'est pas confirmée
// dans le code de son site est écartée.

import { generateJson, normalizeUrl, type AiAccess } from '../_shared/ai.ts'
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

const schema = () => ({
  type: 'object',
  additionalProperties: false,
  required: ['companies'],
  properties: {
    companies: {
      // Pas de maxItems : Claude refuse ce mot-clé dans un schéma ; la limite est dans la consigne et dans le code
      type: 'array',
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
- PME françaises de 10 à 250 salariés : elles ont le budget d'une mission freelance ;
- jamais d'indépendants, d'auto-entrepreneurs, d'artisans ou de commerçants qui travaillent seuls, même si leur site convient ;
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

/**
 * Entreprises candidates, telles que proposées par l'IA (à vérifier ensuite).
 * Une source que la recherche n'a pas réellement consultée est retirée.
 */
export async function findCompaniesUsingTech(
  access: AiAccess,
  technologies: string[],
  count: number,
  excludedDomains: string[]
): Promise<TechCandidate[]> {
  const { text, consultedUrls: consulted } = await generateJson({
    access,
    name: 'tech_companies',
    schema: schema(),
    input: prompt(technologies, count, excludedDomains.slice(0, MAX_EXCLUDED_DOMAINS)),
    webSearch: true,
    timeoutMs: REQUEST_TIMEOUT_MS,
    task: 'La recherche IA',
  })
  if (!text) return []

  const parsed = JSON.parse(text) as { companies?: TechCandidate[] }

  return (parsed.companies ?? [])
    .filter((candidate) => candidate.name?.trim() && candidate.website?.trim())
    .slice(0, count)
    .map((candidate) => ({
      name: candidate.name.trim(),
      website: candidate.website.trim(),
      city: candidate.city?.trim() ?? '',
      activity: candidate.activity?.trim() ?? '',
      evidence: candidate.evidence?.trim() ?? '',
      sourceUrl: candidate.sourceUrl && consulted.has(normalizeUrl(candidate.sourceUrl)) ? candidate.sourceUrl : null,
    }))
}
