import { createClient } from '@/lib/supabase/server'
import type { PipelineRun, PipelineStage, PipelineStageKind, ReminderWithRelations } from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'

export type DashboardOpportunity = {
  id: string
  name: string
  score: number | null
  city: string | null
  sector: string | null
  topSignal: string | null
}

export type DashboardData = {
  stats: {
    // Entreprises en cours (ni perdues, ni hors cible)
    tracked: number
    addedThisWeek: number
    addedBySophieThisWeek: number
    overdueReminders: number
    won: number
    lost: number
    // Gagnées / (gagnées + perdues), null tant qu'aucune n'est tranchée
    successRate: number | null
  }
  todayReminders: ReminderWithRelations[]
  opportunities: DashboardOpportunity[]
  pipeline: { stage: Pick<PipelineStage, 'id' | 'name' | 'color' | 'kind'> | null; count: number }[]
  lastRun: PipelineRun | null
  unidentifiedOffers: number
  nextRunAt: string | null
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Tout ce qu'affiche le tableau de bord, en une série de requêtes parallèles
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return null
  }

  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const [companiesResult, stagesResult, remindersResult, runResult, unidentifiedResult, settingsResult] =
    await Promise.all([
      supabase
        .from('companies')
        .select('id, name, score, stage_id, origin, city, sector, created_at, last_interaction_at')
        .eq('user_id', user.id),
      supabase.from('pipeline_stages').select('id, name, color, kind').eq('user_id', user.id).order('order'),
      supabase
        .from('reminders')
        .select('*, company:companies(id, name)')
        .eq('user_id', user.id)
        .is('completed_at', null)
        .lte('due_at', endOfToday.toISOString())
        .order('due_at', { ascending: true })
        .limit(20),
      supabase
        .from('pipeline_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('unidentified_job_offers')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'new'),
      supabase.from('prospection_settings').select('is_active, next_run_at').eq('user_id', user.id).maybeSingle(),
    ])

  const companies = companiesResult.data ?? []
  const stages = stagesResult.data ?? []
  const kindByStage = new Map<string, PipelineStageKind>(stages.map((stage) => [stage.id, stage.kind]))
  const kindOf = (stageId: string | null): PipelineStageKind => (stageId && kindByStage.get(stageId)) || 'open'

  const weekAgo = Date.now() - WEEK_MS
  const addedThisWeek = companies.filter((company) => new Date(company.created_at).getTime() >= weekAgo)
  const won = companies.filter((company) => kindOf(company.stage_id) === 'won').length
  const lost = companies.filter((company) => kindOf(company.stage_id) === 'lost').length
  const now = Date.now()
  const reminders = remindersResult.data ?? []

  // Meilleures opportunités : pistes en cours, jamais contactées, les mieux notées d'abord
  const candidates = companies
    .filter((company) => kindOf(company.stage_id) === 'open' && !company.last_interaction_at)
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
    .slice(0, 5)

  const { data: signals } = candidates.length
    ? await supabase
        .from('company_signals')
        .select('company_id, detected_at, type:signal_types(label)')
        .in(
          'company_id',
          candidates.map((company) => company.id)
        )
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('detected_at', { ascending: false })
    : { data: [] }

  const topSignalByCompany = new Map<string, string>()
  for (const signal of signals ?? []) {
    const label = (signal.type as { label: string } | null)?.label
    if (label && !topSignalByCompany.has(signal.company_id)) topSignalByCompany.set(signal.company_id, label)
  }

  const countByStage = new Map<string | null, number>()
  for (const company of companies) {
    countByStage.set(company.stage_id, (countByStage.get(company.stage_id) ?? 0) + 1)
  }

  const pipeline: DashboardData['pipeline'] = stages.map((stage) => ({ stage, count: countByStage.get(stage.id) ?? 0 }))
  const withoutStage = countByStage.get(null) ?? 0
  if (withoutStage > 0) pipeline.push({ stage: null, count: withoutStage })

  return {
    stats: {
      tracked: companies.filter((company) => kindOf(company.stage_id) === 'open').length,
      addedThisWeek: addedThisWeek.length,
      addedBySophieThisWeek: addedThisWeek.filter((company) => company.origin === 'detector').length,
      overdueReminders: reminders.filter((reminder) => new Date(reminder.due_at).getTime() < now).length,
      won,
      lost,
      successRate: won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null,
    },
    todayReminders: reminders as ReminderWithRelations[],
    opportunities: candidates.map((company) => ({
      id: company.id,
      name: company.name,
      score: company.score,
      city: company.city,
      sector: company.sector,
      topSignal: topSignalByCompany.get(company.id) ?? null,
    })),
    pipeline,
    lastRun: runResult.data ?? null,
    unidentifiedOffers: unidentifiedResult.count ?? 0,
    nextRunAt: settingsResult.data?.is_active ? settingsResult.data.next_run_at : null,
  }
}
