import { z } from 'zod'
import { sizeCategories, sizeCategoryLabels } from './company'
import type { SizeCategory } from '@/types'
import { DETECTABLE_TECHNOLOGIES } from '@/lib/constants/technologies'
import type { Json } from '@/types/database'

/**
 * Profil de client idéal (ICP) : ce qui compte dans le score d'une entreprise.
 * Les points appliqués sont ceux de compute_company_score (migration 00016).
 */

export const SIZE_FIT_OPTIONS = [
  { value: 'preferred', label: 'Idéale', points: 15 },
  { value: 'accepted', label: 'Acceptée', points: 8 },
  { value: 'excluded', label: 'Hors cible', points: 0 },
] as const

export type SizeFit = (typeof SIZE_FIT_OPTIONS)[number]['value']

export { sizeCategories, sizeCategoryLabels }

export const MAX_SIGNAL_WEIGHT = 60

export const icpSchema = z.object({
  name: z.string().trim().min(1, 'Donnez un nom à votre client idéal').max(100, 'Le nom est trop long'),
  sizeFit: z.record(z.enum(sizeCategories), z.enum(['preferred', 'accepted', 'excluded'])),
  signalWeights: z.record(
    z.string(),
    z
      .number({ invalid_type_error: 'Indiquez un nombre de points' })
      .int('Les points doivent être un nombre entier')
      .min(0, 'Pas de points négatifs')
      .max(MAX_SIGNAL_WEIGHT, `Au plus ${MAX_SIGNAL_WEIGHT} points par signal`)
  ),
  // Tarif journalier moyen : sert à juger si le chiffre d'affaires d'une entreprise suffit
  dayRate: z
    .number({ invalid_type_error: 'Indiquez un montant' })
    .int('Un montant entier, en euros')
    .min(50, 'Au moins 50 €')
    .max(5000, 'Au plus 5 000 €')
    .nullable(),
  // Technologies qui déclenchent le signal « Stack technique compatible »
  techStack: z.array(z.enum(DETECTABLE_TECHNOLOGIES)).transform((technologies) => [...new Set(technologies)]),
  excludeKeywords: z
    .array(z.string().trim().toLowerCase().min(2, 'Mot-clé trop court').max(60, 'Mot-clé trop long'))
    .max(30, 'Au plus 30 mots-clés')
    .transform((keywords) => [...new Set(keywords)]),
})

export type IcpInput = z.input<typeof icpSchema>

// Critères stockés dans icp_profiles.criteria (les clés inconnues sont conservées)
export type IcpCriteria = {
  countries?: string[]
  size_categories?: { preferred?: string[]; accepted?: string[] }
  exclude_keywords?: string[]
  tech_stack?: string[]
  day_rate?: number
  [key: string]: Json | undefined
}

// Une mission type de 20 jours ne doit pas dépasser 4 % du chiffre d'affaires annuel :
// au tarif de 600 €, il faut donc au moins 300 000 € de CA
export const MISSION_DAYS = 20
const MAX_SHARE_OF_REVENUE = 0.04

export type BudgetFit = 'comfortable' | 'tight' | 'unknown'

export function budgetFit(revenue: number | null | undefined, dayRate: number | null | undefined): BudgetFit {
  if (!revenue || !dayRate) return 'unknown'
  return dayRate * MISSION_DAYS <= revenue * MAX_SHARE_OF_REVENUE ? 'comfortable' : 'tight'
}

export function minimumRevenue(dayRate: number): number {
  return (dayRate * MISSION_DAYS) / MAX_SHARE_OF_REVENUE
}

export function sizeFitFromCriteria(criteria: IcpCriteria): Record<SizeCategory, SizeFit> {
  const preferred = criteria.size_categories?.preferred ?? []
  const accepted = criteria.size_categories?.accepted ?? []
  return Object.fromEntries(
    sizeCategories.map((category) => [
      category,
      preferred.includes(category) ? 'preferred' : accepted.includes(category) ? 'accepted' : 'excluded',
    ])
  ) as Record<SizeCategory, SizeFit>
}

export function sizeCategoriesFromFit(sizeFit: Partial<Record<SizeCategory, SizeFit>>) {
  const entries = Object.entries(sizeFit) as [SizeCategory, SizeFit][]
  return {
    preferred: entries.filter(([, fit]) => fit === 'preferred').map(([category]) => category),
    accepted: entries.filter(([, fit]) => fit === 'accepted').map(([category]) => category),
  }
}
