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
 * Mots-clés proposés au départ : des formulations de quelqu'un qui cherche (pas d'un
 * freelance qui se présente), puis une par technologie de la freelance
 */
export function suggestedPostKeywords(technologyLabels: string[]): string[] {
  return [
    'cherche un développeur freelance',
    'recherche développeur freelance',
    'mission freelance développeur web',
    ...technologyLabels.map((label) => `freelance ${label}`),
  ].slice(0, MAX_POST_KEYWORDS)
}

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
