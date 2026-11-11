import { createClient } from '@/lib/supabase/server'
import type { PipelineRun, ProspectionSettings, UnidentifiedJobOffer } from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'
import { parisMidnight, PLAN_LIMITS, type PlanKey } from '@/lib/billing'

type Schedule = Pick<ProspectionSettings, 'is_active' | 'next_run_at' | 'days_of_week' | 'run_hour' | 'timezone'>

/**
 * Offre Essentiel : une recherche par semaine, comptée au jour près (heure de Paris), les passages
 * échoués ne comptent pas. Renvoie la date à partir de laquelle la suivante est possible, ou null si
 * elle l'est déjà. Même règle que nextWeeklyRun dans supabase/functions/prospection-run.
 */
export async function getWeeklyRunAvailableAt(plan: PlanKey | null): Promise<string | null> {
  if (!plan || PLAN_LIMITS[plan].runsPerWeek === null) return null
  const user = await getAuthUser()
  if (!user) return null

  const supabase = await createClient()
  const { data } = await supabase
    .from('pipeline_runs')
    .select('started_at')
    .eq('user_id', user.id)
    .neq('status', 'failed')
    .gte('started_at', parisMidnight(new Date(), -6).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? parisMidnight(new Date(data.started_at), 7).toISOString() : null
}

/**
 * Prochaine recherche automatique qui aura vraiment lieu. Avec l'offre Essentiel, celles qui tombent
 * avant la date permise sont sautées par Sophie : on affiche la première qui passera.
 */
export async function getNextScheduledRun(schedule: Schedule | null, availableAt: string | null): Promise<string | null> {
  if (!schedule?.is_active || !schedule.next_run_at) return null
  if (!availableAt || new Date(schedule.next_run_at) >= new Date(availableAt)) return schedule.next_run_at

  const supabase = await createClient()
  const { data } = await supabase.rpc('compute_next_prospection_run', {
    p_days: schedule.days_of_week,
    p_hour: schedule.run_hour,
    p_tz: schedule.timezone,
    // Une recherche planifiée à minuit pile, le jour permis, passe aussi
    p_after: new Date(new Date(availableAt).getTime() - 1000).toISOString(),
  })
  return data ?? schedule.next_run_at
}

export async function getProspectionSettings(): Promise<ProspectionSettings | null> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return null
  }

  const { data } = await supabase
    .from('prospection_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return data
}

/**
 * Derniers passages de Sophie, du plus récent au plus ancien
 */
export async function getPipelineRuns(limit = 20): Promise<PipelineRun[]> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return []
  }

  const { data } = await supabase
    .from('pipeline_runs')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit)

  return data ?? []
}

/**
 * Offres sans nom d'entreprise encore à traiter, les plus récentes d'abord
 */
export async function getUnidentifiedOffers(limit = 50): Promise<UnidentifiedJobOffer[]> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return []
  }

  const { data } = await supabase
    .from('unidentified_job_offers')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'new')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  return data ?? []
}

/**
 * Noms des entreprises suivies, pour rattacher une offre anonyme
 */
export async function getCompanyChoices(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return []
  }

  const { data } = await supabase
    .from('companies')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')
    .limit(500)

  return data ?? []
}
