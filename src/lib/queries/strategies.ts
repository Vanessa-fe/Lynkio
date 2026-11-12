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
}

/** Recherches enregistrées, de la plus ancienne à la plus récente, avec ce qu'elles ont trouvé */
export async function getStrategies(): Promise<StrategyOverview[]> {
  const user = await getAuthUser()
  if (!user) return []
  const supabase = await createClient()

  const [{ data: strategies, error }, { data: found }] = await Promise.all([
    supabase
      .from('prospect_strategies')
      .select('id, name, approach, is_active, filters, last_run_at')
      .eq('user_id', user.id)
      .order('created_at'),
    supabase.from('companies').select('strategy_id').eq('user_id', user.id).not('strategy_id', 'is', null),
  ])
  if (error) {
    console.error('getStrategies', error)
    return []
  }

  const counts = new Map<string, number>()
  for (const row of found ?? []) {
    if (row.strategy_id) counts.set(row.strategy_id, (counts.get(row.strategy_id) ?? 0) + 1)
  }

  return (strategies ?? []).map((strategy) => ({
    id: strategy.id,
    name: strategy.name,
    approach: strategy.approach === 'partner' ? 'partner' : 'profile',
    isActive: strategy.is_active,
    ...readStrategyFilters(strategy.filters),
    lastRunAt: strategy.last_run_at,
    companiesFound: counts.get(strategy.id) ?? 0,
  }))
}

/** Une recherche (pour « Pourquoi cette entreprise ») */
export async function getStrategy(id: string): Promise<StrategyOverview | null> {
  const strategies = await getStrategies()
  return strategies.find((strategy) => strategy.id === id) ?? null
}
