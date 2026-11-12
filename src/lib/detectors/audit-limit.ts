import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { StackDetectionError } from './stack'

export async function reserveWebsiteAudit() {
  const client = await createClient()
  const { data, error } = await client.rpc('hit_my_rate_limit', {
    p_action: 'website_audit', p_max: 20, p_window_seconds: 86400,
  })
  if (error) throw new StackDetectionError('Impossible de vérifier le quota d’analyse.', 503)
  if (!data) throw new StackDetectionError('La limite de 20 analyses par jour est atteinte.', 429)
}
