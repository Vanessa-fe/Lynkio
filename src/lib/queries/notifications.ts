import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { DigestCounts, SophieFrequency } from '@/types/database'

export type SophieNotificationRow = {
  id: string
  kind: 'signal' | 'digest'
  created_at: string
  read_at: string | null
  company_id: string | null
  title: string
  source: string
  source_url: string | null
  detected_at: string | null
  event_at: string | null
  period_start: string | null
  period_end: string | null
  counts: DigestCounts | null
}

/** Préférences d'alertes (par défaut : tout désactivé, rien n'est envoyé sans accord) */
export async function getSophiePreferences(): Promise<{ frequency: SophieFrequency; digest: boolean }> {
  const user = await getAuthUser()
  if (!user) return { frequency: 'off', digest: false }
  const supabase = await createClient()
  const { data } = await supabase.from('sophie_preferences').select('frequency, digest_from').eq('user_id', user.id).maybeSingle()
  return { frequency: data?.frequency ?? 'off', digest: !!data?.digest_from }
}

/** Dernières alertes et bilans, les plus récents d'abord */
export async function getSophieNotifications(limit = 50): Promise<SophieNotificationRow[]> {
  const user = await getAuthUser()
  if (!user) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('sophie_notifications')
    .select('id, kind, created_at, read_at, company_id, title, source, source_url, detected_at, event_at, period_start, period_end, counts')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)
  return (data ?? []) as SophieNotificationRow[]
}

/** Nombre d'alertes et de bilans non lus (tableau de bord) */
export async function countUnreadNotifications(): Promise<number> {
  const user = await getAuthUser()
  if (!user) return 0
  const supabase = await createClient()
  const { count } = await supabase
    .from('sophie_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)
  return count ?? 0
}
