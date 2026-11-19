import 'server-only'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { getAccess, parisMonthStart } from '@/lib/billing'
import { getBilling } from '@/lib/queries/billing'
import { getMyApiKeys } from '@/lib/queries/api-keys'
import { isAiProvider } from '@/lib/constants/api-keys'
import { AI_ACTIONS, aiQuota, type AiAction } from '@/lib/ai-quota'

/**
 * D'où vient l'IA de Sophie pour le compte connecté :
 * - own : sa propre clé (pas de quota) ;
 * - included : IA incluse dans Pro (essai compris), avec les quotas du mois ;
 * - none : offre Essentiel sans clé, ou accès terminé.
 */
export type AiAvailability =
  | { mode: 'own' }
  | { mode: 'included'; trial: boolean; usage: { action: AiAction; used: number; quota: number }[] }
  | { mode: 'none'; plan: 'essentiel' | null }

export const getAiAvailability = cache(async (): Promise<AiAvailability> => {
  const [keys, billing, user] = await Promise.all([getMyApiKeys(), getBilling(), getAuthUser()])
  if (keys.some((key) => isAiProvider(key.provider))) return { mode: 'own' }

  const access = getAccess(billing)
  if (access.plan !== 'pro' || !user) return { mode: 'none', plan: access.plan === 'essentiel' ? 'essentiel' : null }

  const trial = access.kind === 'trial'
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_usage')
    .select('action')
    .eq('user_id', user.id)
    .gte('created_at', parisMonthStart(new Date()).toISOString())
  const counts = new Map<string, number>()
  for (const row of data ?? []) counts.set(row.action, (counts.get(row.action) ?? 0) + 1)
  return {
    mode: 'included',
    trial,
    usage: AI_ACTIONS.map((action) => ({ action, used: counts.get(action) ?? 0, quota: aiQuota(action, trial) })),
  }
})

/** Sophie peut-elle utiliser l'IA (sa clé, ou l'IA incluse dans Pro) ? */
export async function hasAiAccess(): Promise<boolean> {
  return (await getAiAvailability()).mode !== 'none'
}
