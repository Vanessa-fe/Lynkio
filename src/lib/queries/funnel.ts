import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { SECTOR_GROUPS } from '@/lib/constants/client-sectors'
import { recommend, type Suggestion } from '@/lib/prospect-recommendations'
import { computeFunnel, reachedSteps, SMALL_SAMPLE, FUNNEL_PERIODS, type FunnelResult } from '@/lib/funnel'

export { FUNNEL_PERIODS }

export type FunnelFilters = { period: string; strategy: string; source: string; sector: string }

export type FunnelPageData = {
  suggestions: Suggestion[]
  userId: string
  result: FunnelResult
  filters: FunnelFilters
  since: string | null
  options: {
    strategies: { id: string; name: string }[]
    sources: { id: string; name: string }[]
    sectors: { key: string; label: string }[]
  }
}

const ALL = 'all'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Secteur d'une fiche : groupe du catalogue d'après son code NAF, sinon « autre » */
function sectorKey(nafCode: string | null): string {
  if (!nafCode) return 'unknown'
  return SECTOR_GROUPS.find((group) => group.nafCodes.includes(nafCode))?.key ?? 'other'
}

// Une page PostgREST peut être plafonnée. Demander le total évite de classer des groupes tronqués.
async function readPages<T>(load: (start: number, end: number) => PromiseLike<{
  data: T[] | null; count: number | null; error: { message: string } | null
}>): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const { data, count, error } = await load(rows.length, rows.length + 999)
    if (error || !data || count === null) throw new Error('Lecture des résultats impossible')
    rows.push(...data)
    if (rows.length >= count) return rows
    if (!data.length) throw new Error('Lecture des résultats incomplète')
  }
}

/**
 * Données de l'entonnoir pour l'utilisateur connecté (ses seules fiches, RLS).
 * Les filtres invalides retombent sur « tout ».
 */
export async function getFunnelData(raw: Partial<FunnelFilters>): Promise<FunnelPageData | null> {
  const user = await getAuthUser()
  if (!user) return null
  const supabase = await createClient()

  const period = FUNNEL_PERIODS.find((option) => option.value === raw.period) ?? FUNNEL_PERIODS[1]
  const filters: FunnelFilters = {
    period: period.value,
    strategy: raw.strategy === 'none' || (raw.strategy && UUID.test(raw.strategy)) ? raw.strategy : ALL,
    source: raw.source && UUID.test(raw.source) ? raw.source : ALL,
    sector: raw.sector && /^[a-z_]{2,40}$/.test(raw.sector) ? raw.sector : ALL,
  }
  const since = period.days ? new Date(Date.now() - period.days * 86_400_000).toISOString() : null

  let companiesQuery = supabase
    .from('companies')
    .select('id, stage_id, strategy_id, source_id, naf_code', { count: 'exact' })
    .eq('user_id', user.id)
    .order('id')
  if (since) companiesQuery = companiesQuery.gte('created_at', since)
  if (filters.strategy === 'none') companiesQuery = companiesQuery.is('strategy_id', null)
  else if (filters.strategy !== ALL) companiesQuery = companiesQuery.eq('strategy_id', filters.strategy)
  if (filters.source !== ALL) companiesQuery = companiesQuery.eq('source_id', filters.source)

  const [companiesResult, stages, strategies, sources] = await Promise.all([
    readPages((start, end) => companiesQuery.range(start, end)),
    supabase.from('pipeline_stages').select('id, name, kind, role, order, is_default').eq('user_id', user.id),
    supabase.from('prospect_strategies').select('id, name').eq('user_id', user.id).order('created_at'),
    supabase.from('lead_sources').select('id, name').eq('user_id', user.id).order('order'),
  ])

  if (stages.error || strategies.error || sources.error) throw new Error('Lecture des filtres impossible')
  const companies = companiesResult.filter(
    (company) => filters.sector === ALL || sectorKey(company.naf_code) === filters.sector
  )
  const ids = companies.map((company) => company.id)

  // Historique et échanges des seules fiches de la cohorte (par paquets, pour rester sous la limite d'URL)
  const events: { company_id: string; to_stage_id: string | null }[] = []
  const interactions: { company_id: string; type: string; direction: string | null; status: string }[] = []
  for (let index = 0; index < ids.length; index += 150) {
    const chunk = ids.slice(index, index + 150)
    const [eventRows, interactionRows] = await Promise.all([
      readPages((start, end) => supabase.from('company_stage_events').select('company_id, to_stage_id', { count: 'exact' })
        .in('company_id', chunk).order('id').range(start, end)),
      readPages((start, end) => supabase.from('company_interactions').select('company_id, type, direction, status', { count: 'exact' })
        .in('company_id', chunk).order('id').range(start, end)),
    ])
    events.push(...eventRows)
    interactions.push(...interactionRows)
  }

  const input = {
    companies: companies.map(({ id, stage_id }) => ({ id, stage_id })),
    stages: (stages.data ?? []).map((stage) => ({ ...stage, role: stage.role ?? null })),
    events,
    interactions,
  }
  const reached = reachedSteps(input)
  const result = computeFunnel(input, reached)
  const strategyNames = new Map(strategies.data.map(s => [s.id, s.name]))
  const stageKinds = new Map(stages.data.map(s => [s.id, s.kind]))
  const suggestions = recommend(companies.map(company => {
    const sector = SECTOR_GROUPS.find(group => company.naf_code && group.nafCodes.includes(company.naf_code))
    const strategy = company.strategy_id && strategyNames.get(company.strategy_id)
    const kind = company.stage_id && stageKinds.get(company.stage_id)
    return {
      step: reached.get(company.id) ?? 0,
      available: !kind || kind === 'open',
      targets: [
        ...(sector ? [{ dimension: 'sector' as const, id: sector.key, label: sector.label }] : []),
        ...(strategy && company.strategy_id ? [{ dimension: 'strategy' as const, id: company.strategy_id, label: strategy }] : []),
      ],
    }
  }), SMALL_SAMPLE)

  const sectorKeys = new Set(companiesResult.map((company) => sectorKey(company.naf_code)))
  return {
    result,
    userId: user.id,
    suggestions,
    filters,
    since,
    options: {
      strategies: strategies.data ?? [],
      sources: sources.data ?? [],
      sectors: [
        ...SECTOR_GROUPS.filter((group) => sectorKeys.has(group.key)).map(({ key, label }) => ({ key, label })),
        ...(sectorKeys.has('other') ? [{ key: 'other', label: 'Autre secteur' }] : []),
        ...(sectorKeys.has('unknown') ? [{ key: 'unknown', label: 'Secteur inconnu' }] : []),
      ],
    },
  }
}
