'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'
import { isInactiveProspectMonths, isLinkedinPostsDays } from '@/lib/constants/data-retention'

type ActionResult = { success: boolean; error?: string; message?: string }

/**
 * Enregistre les durées de conservation du compte (le changement est journalisé par la base)
 */
export async function saveRetentionSettings(input: {
  inactiveProspectMonths: number
  autoPurgeEnabled: boolean
  linkedinPostsDays: number
}): Promise<ActionResult> {
  if (!isInactiveProspectMonths(input.inactiveProspectMonths) || !isLinkedinPostsDays(input.linkedinPostsDays)) {
    return { success: false, error: 'Durée non prévue' }
  }
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }

  const supabase = await createClient()
  const { error } = await supabase.from('data_retention_settings').upsert(
    {
      user_id: user.id,
      inactive_prospect_months: input.inactiveProspectMonths,
      auto_purge_enabled: input.autoPurgeEnabled === true,
      linkedin_posts_days: input.linkedinPostsDays,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) {
    captureServerError(error, user.id, { action: 'save_retention_settings' })
    return { success: false, error: 'Enregistrement impossible. Réessayez.' }
  }

  captureServerEvent(user.id, 'retention_settings_saved', {
    months: input.inactiveProspectMonths,
    auto_purge: input.autoPurgeEnabled,
    linkedin_posts_days: input.linkedinPostsDays,
  })
  revalidatePath('/settings/account')
  return { success: true, message: 'Réglages enregistrés.' }
}

/**
 * « Nettoyer maintenant » : applique tout de suite la durée choisie (nettoyage activé seulement)
 */
export async function purgeInactiveProspectsNow(): Promise<ActionResult> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }

  const supabase = await createClient()
  const { data: removed, error } = await supabase.rpc('purge_my_inactive_prospects')
  if (error) {
    captureServerError(error, user.id, { action: 'purge_inactive_prospects' })
    return { success: false, error: 'Nettoyage impossible pour le moment. Réessayez.' }
  }

  captureServerEvent(user.id, 'retention_purged_manually', { companies: removed ?? 0 })
  revalidatePath('/settings/account')
  revalidatePath('/companies')
  return {
    success: true,
    message: removed ? `${removed} entreprise${removed > 1 ? 's' : ''} sans suite effacée${removed > 1 ? 's' : ''}.` : 'Rien à effacer.',
  }
}
