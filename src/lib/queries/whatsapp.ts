import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { getAccess } from '@/lib/billing'
import { getBilling } from '@/lib/queries/billing'
import { WHATSAPP_DEFAULT_DAILY_LIMIT, whatsappDayStart, type WhatsappUsage } from '@/lib/whatsapp'

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Messages WhatsApp envoyés aujourd'hui (depuis minuit, heure de Paris) et plafond choisi */
export async function readWhatsappUsage(supabase: Supabase, userId: string): Promise<{ used: number; limit: number }> {
  const [{ count }, { data: profile }] = await Promise.all([
    supabase
      .from('company_interactions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'whatsapp')
      .eq('direction', 'outgoing')
      .eq('status', 'done')
      .gte('occurred_at', whatsappDayStart().toISOString()),
    supabase.from('user_profiles').select('whatsapp_daily_limit').eq('id', userId).maybeSingle(),
  ])
  return { used: count ?? 0, limit: profile?.whatsapp_daily_limit ?? WHATSAPP_DEFAULT_DAILY_LIMIT }
}

/** Compteur WhatsApp du compte connecté, pour la fiche entreprise */
export const getWhatsappUsage = cache(async (): Promise<WhatsappUsage> => {
  const [user, billing] = await Promise.all([getAuthUser(), getBilling()])
  const plan = getAccess(billing).plan
  if (!user || plan !== 'pro') return { plan, used: 0, limit: WHATSAPP_DEFAULT_DAILY_LIMIT }
  const supabase = await createClient()
  return { plan, ...(await readWhatsappUsage(supabase, user.id)) }
})
