import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_RETENTION } from '@/lib/constants/data-retention'
import type { Database } from '@/types/database'

type AccessLogEntry = Database['public']['Tables']['data_access_log']['Row']

/**
 * Réglages de conservation du compte (valeurs par défaut s'il n'a jamais rien choisi),
 * aperçu de ce que le nettoyage effacerait, et derniers accès journalisés
 */
export async function getDataRetentionOverview(userId: string) {
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('data_retention_settings')
    .select('inactive_prospect_months, auto_purge_enabled, linkedin_posts_days, last_purge_at')
    .eq('user_id', userId)
    .maybeSingle()

  const current = settings ?? DEFAULT_RETENTION
  const [{ data: preview }, { data: log }] = await Promise.all([
    supabase.rpc('preview_my_retention', { p_months: current.inactive_prospect_months }),
    supabase
      .from('data_access_log')
      .select('id, action, details, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    settings: current,
    preview: preview?.[0] ?? { companies: 0, contacts: 0 },
    accessLog: (log ?? []) as Pick<AccessLogEntry, 'id' | 'action' | 'details' | 'created_at'>[],
  }
}
