import { z } from 'zod'

// Une page de résultats par mot-clé toutes les 2 heures : au-delà, la recherche ne
// ressemble plus à celle d'une personne
export const MAX_POST_KEYWORDS = 5

export const linkedinPostSearchSchema = z
  .object({
    enabled: z.boolean(),
    keywords: z
      .array(
        z
          .string()
          .trim()
          .min(2, 'Un mot-clé fait au moins 2 caractères')
          .max(100, 'Un mot-clé fait au plus 100 caractères')
      )
      .max(MAX_POST_KEYWORDS, `${MAX_POST_KEYWORDS} mots-clés au plus`)
      // « Freelance React » et « freelance react » : un seul
      .transform((keywords) => [
        ...new Map(keywords.map((keyword) => [keyword.toLocaleLowerCase('fr'), keyword])).values(),
      ]),
  })
  .refine((data) => !data.enabled || data.keywords.length > 0, {
    message: 'Ajoutez au moins un mot-clé',
    path: ['keywords'],
  })

export type LinkedinPostSearchInput = z.input<typeof linkedinPostSearchSchema>

/**
 * Mots-clés proposés au départ : des phrases courtes de quelqu'un qui cherche (pas d'un
 * freelance qui se présente). L'extension les cherche mot pour mot : une phrase longue,
 * ou suivie d'une technologie, n'est presque jamais écrite telle quelle.
 */
export function suggestedPostKeywords(): string[] {
  return [
    'cherche un développeur',
    'recherche un développeur',
    "besoin d'un développeur",
    'cherche un freelance',
    'recherche un freelance',
  ].slice(0, MAX_POST_KEYWORDS)
}

/** Au-delà de 3 mots, une phrase cherchée mot pour mot ne ramène presque rien */
export const LONG_POST_KEYWORD_WORDS = 4

/**
 * « Jean-Pierre Martin 🚀 | CTO » → { firstName: 'Jean-Pierre', lastName: 'Martin' } :
 * le nom affiché sur LinkedIn porte parfois des émojis ou un titre après une barre
 */
export function splitAuthorName(name: string): { firstName: string | null; lastName: string | null } {
  const clean = name
    .split(/[|,•·(]/)[0]!
    .replace(/[^\p{L}\p{M}\s'’.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const [first, ...rest] = clean.split(' ')
  return { firstName: first?.slice(0, 100) || null, lastName: rest.join(' ').slice(0, 100) || null }
}
