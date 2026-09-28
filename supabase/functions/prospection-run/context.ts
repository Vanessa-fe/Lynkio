// Types et outils partagés par l'orchestration et les détecteurs

export type SourceKey = 'job_postings' | 'recent_creations'

export type Settings = {
  departments: string[]
  excluded_naf_sections: string[]
  max_companies_per_run: number
  sources: SourceKey[]
  bodacc_cursor: string | null
  job_postings_cursor: string | null
}

export type Context = {
  userId: string
  professionKey: string | null
  stageId: string | null
  sourceId: string | null
  excludedKeywords: string[]
  // Surcharge des poids des signaux par le client idéal (icp_profiles.signal_weights)
  signalWeights: Record<string, number>
  // Tailles idéales et acceptées du client idéal ; null = pas de préférence
  sizeCategories: string[] | null
}

// Résultat d'un détecteur, enregistré dans pipeline_runs.details.sources
export type SourceStats = {
  seen: number
  created: number
  skipped: number
  // Signaux ajoutés à des entreprises déjà suivies (ex. elle recrute à nouveau)
  signalsAdded: number
  // Offres sans nom d'entreprise gardées pour être identifiées à la main
  unidentified: number
  skipReasons: Record<string, number>
  createdCompanies: { id: string; name: string }[]
  since?: string | null
  until?: string | null
  error?: string
}

export function newSourceStats(): SourceStats {
  return { seen: 0, created: 0, skipped: 0, signalsAdded: 0, unidentified: 0, skipReasons: {}, createdCompanies: [] }
}

export function skip(stats: SourceStats, reason: string) {
  stats.skipped++
  stats.skipReasons[reason] = (stats.skipReasons[reason] ?? 0) + 1
}

// Nombre de nouvelles entreprises encore autorisées pendant ce passage,
// partagé entre les sources (la première servie est la plus utile)
export type Budget = { remaining: number }

// Erreur dont le message peut être montré tel quel à l'utilisateur
export class UserFacingError extends Error {}

export function errorMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message
  return `Erreur technique : ${error instanceof Error ? error.message : String(error)}`
}
