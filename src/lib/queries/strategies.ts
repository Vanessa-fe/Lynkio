import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { readStrategyFilters } from '@/lib/validations/strategy'

export type StrategyOverview = {
  id: string
  name: string
  approach: 'profile' | 'partner'
  isActive: boolean
  sectorGroups: string[]
  sizes: string[]
  departments: string[]
  lastRunAt: string | null
  // Entreprises trouvées par cette recherche (encore dans vos entreprises)
  companiesFound: number
  // Derniers passages de Sophie qui ont ajouté des entreprises avec cette recherche (au plus 5)
  runs: StrategyRun[]
}

export type StrategyRun = {
  runId: string
  startedAt: string
  triggeredBy: string
  // Entreprises ajoutées par ce passage avec cette recherche (encore dans vos entreprises)
  created: number
}

// Passages relus pour l'historique par recherche
const RUNS_FOR_HISTORY = 30
const RUNS_PER_STRATEGY = 5

/** Recherches enregistrées, de la plus ancienne à la plus récente, avec ce qu'elles ont trouvé */
export async function getStrategies(): Promise<StrategyOverview[]> {
  const user = await getAuthUser()
  if (!user) return []
  const supabase = await createClient()

  const [{ data: strategies, error }, { data: found }, { data: runs }] = await Promise.all([
    supabase
      .from('prospect_strategies')
      .select('id, name, approach, is_active, filters, last_run_at')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase.from('companies').select('id, strategy_id').eq('user_id', user.id).not('strategy_id', 'is', null),
    supabase
      .from('pipeline_runs')
      .select('id, started_at, triggered_by, details')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(RUNS_FOR_HISTORY),
  ])
  if (error) {
    console.error('getStrategies', error)
    return []
  }

  const counts = new Map<string, number>()
  for (const row of found ?? []) {
    if (row.strategy_id) counts.set(row.strategy_id, (counts.get(row.strategy_id) ?? 0) + 1)
  }

  // Historique par recherche : chaque passage liste les fiches créées (details.created) ; la fiche dit
  // quelle recherche l'a trouvée (companies.strategy_id). Aucune donnée en plus à enregistrer.
  const strategyOfCompany = new Map((found ?? []).map((row) => [row.id, row.strategy_id]))
  const runsByStrategy = new Map<string, StrategyRun[]>()
  for (const run of runs ?? []) {
    const details = (run.details ?? {}) as { created?: unknown }
    const created = Array.isArray(details.created) ? details.created : []
    const perStrategy = new Map<string, number>()
    for (const item of created) {
      const id = item && typeof item === 'object' ? (item as { id?: unknown }).id : null
      const strategyId = typeof id === 'string' ? strategyOfCompany.get(id) : null
      if (strategyId) perStrategy.set(strategyId, (perStrategy.get(strategyId) ?? 0) + 1)
    }
    for (const [strategyId, count] of perStrategy) {
      const list = runsByStrategy.get(strategyId) ?? []
      if (list.length < RUNS_PER_STRATEGY) {
        list.push({ runId: run.id, startedAt: run.started_at, triggeredBy: run.triggered_by, created: count })
      }
      runsByStrategy.set(strategyId, list)
    }
  }

  return (strategies ?? []).map((strategy) => ({
    id: strategy.id,
    name: strategy.name,
    approach: strategy.approach === 'partner' ? 'partner' : 'profile',
    isActive: strategy.is_active,
    ...readStrategyFilters(strategy.filters),
    lastRunAt: strategy.last_run_at,
    companiesFound: counts.get(strategy.id) ?? 0,
    runs: runsByStrategy.get(strategy.id) ?? [],
  }))
}

/** Une recherche (pour « Pourquoi cette entreprise ») */
export async function getStrategy(id: string): Promise<StrategyOverview | null> {
  const strategies = await getStrategies()
  return strategies.find((strategy) => strategy.id === id) ?? null
}
