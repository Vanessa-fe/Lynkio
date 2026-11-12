import { z } from 'zod'
import { SECTOR_GROUPS, STRATEGY_SIZES } from '@/lib/constants/client-sectors'
import { DEPARTMENTS } from '@/lib/validations/prospection'

const sectorKeys = SECTOR_GROUPS.map((group) => group.key) as [string, ...string[]]
const sizeValues = STRATEGY_SIZES.map((size) => size.value) as [string, ...string[]]

/** « Nouvelle recherche » : approche, secteurs, tailles, zone */
export const strategySchema = z.object({
  name: z.string().trim().min(1, 'Donnez un nom à cette recherche').max(80, '80 caractères au plus'),
  approach: z.enum(['profile', 'partner']),
  sectorGroups: z.array(z.enum(sectorKeys)).min(1, 'Choisissez au moins un secteur').max(12, '12 secteurs au plus'),
  sizes: z.array(z.enum(sizeValues)).min(1, 'Choisissez au moins une taille'),
  departments: z
    .array(z.string().refine((code) => code in DEPARTMENTS, 'Département inconnu'))
    .min(1, 'Choisissez au moins un département')
    .max(20, '20 départements au plus'),
})

export type StrategyInput = z.infer<typeof strategySchema>

/** Filtres lus en base (JSON libre) : on ne garde que des valeurs connues */
export function readStrategyFilters(filters: unknown): { sectorGroups: string[]; sizes: string[]; departments: string[] } {
  const value = (filters && typeof filters === 'object' ? filters : {}) as Record<string, unknown>
  const strings = (input: unknown) => (Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : [])
  return {
    sectorGroups: strings(value.sector_groups).filter((key) => sectorKeys.includes(key)),
    sizes: strings(value.sizes).filter((size) => sizeValues.includes(size)),
    departments: strings(value.departments).filter((code) => code in DEPARTMENTS),
  }
}
