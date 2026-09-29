import { createClient } from '@/lib/supabase/server'
import type { PipelineRun, ProspectionSettings, UnidentifiedJobOffer } from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'

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
