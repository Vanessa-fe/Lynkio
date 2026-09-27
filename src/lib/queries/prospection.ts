import { createClient } from '@/lib/supabase/server'
import type { PipelineRun, ProspectionSettings } from '@/types'

export async function getProspectionSettings(): Promise<ProspectionSettings | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const {
    data: { user },
  } = await supabase.auth.getUser()

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
