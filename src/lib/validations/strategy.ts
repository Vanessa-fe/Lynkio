import { z } from 'zod'
import { SECTOR_GROUPS, STRATEGY_AGES, STRATEGY_SIZES } from '@/lib/constants/client-sectors'
import { DEPARTMENTS } from '@/lib/validations/prospection'

const sectorKeys = SECTOR_GROUPS.map((group) => group.key) as [string, ...string[]]
const sizeValues = STRATEGY_SIZES.map((size) => size.value) as [string, ...string[]]
const ageValues = STRATEGY_AGES.map((age) => age.value) as [string, ...string[]]

// Critères « souples » : Sophie prend aussi les entreprises proches, avec moins de points
export const SOFT_CRITERIA = ['sizes', 'departments', 'ages'] as const
export type SoftCriterion = (typeof SOFT_CRITERIA)[number]

/** « Nouvelle recherche » : approche, secteurs, tailles, ancienneté (facultative), zone */
export const strategySchema = z.object({
  name: z.string().trim().min(1, 'Donnez un nom à cette recherche').max(80, '80 caractères au plus'),
  approach: z.enum(['profile', 'partner']),
  sectorGroups: z.array(z.enum(sectorKeys)).min(1, 'Choisissez au moins un secteur').max(12, '12 secteurs au plus'),
  sizes: z.array(z.enum(sizeValues)).min(1, 'Choisissez au moins une taille'),
  // Vide : toutes les anciennetés
  ages: z
    .array(z.enum(ageValues))
    .default([])
    .transform((ages) => (ages.length === ageValues.length ? [] : [...new Set(ages)])),
  // Vide : tous les critères sont obligatoires (comportement d'avant)
  soft: z
    .array(z.enum(SOFT_CRITERIA))
    .default([])
    .transform((soft) => [...new Set(soft)]),
  departments: z
    .array(z.string().refine((code) => code in DEPARTMENTS, 'Département inconnu'))
    .min(1, 'Choisissez au moins un département')
    .max(20, '20 départements au plus'),
})

export type StrategyInput = z.input<typeof strategySchema>

/** Filtres lus en base (JSON libre) : on ne garde que des valeurs connues */
export function readStrategyFilters(filters: unknown): {
  sectorGroups: string[]
  sizes: string[]
  ages: string[]
  departments: string[]
  soft: SoftCriterion[]
} {
  const value = (filters && typeof filters === 'object' ? filters : {}) as Record<string, unknown>
  const strings = (input: unknown) => (Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : [])
  return {
    sectorGroups: strings(value.sector_groups).filter((key) => sectorKeys.includes(key)),
    sizes: strings(value.sizes).filter((size) => sizeValues.includes(size)),
    ages: strings(value.ages).filter((age) => ageValues.includes(age)),
    soft: strings(value.soft).filter((item): item is SoftCriterion => (SOFT_CRITERIA as readonly string[]).includes(item)),
    departments: strings(value.departments).filter((code) => code in DEPARTMENTS),
  }
}
