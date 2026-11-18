'use server'

import { redirect } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { removeBrevoContact } from '@/lib/brevo'
import { after } from 'next/server'
import { captureServerError, erasePostHogPerson, getPostHogServer } from '@/lib/posthog-server'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/constants/account'

type ActionResult = { success: boolean; error?: string }

/**
 * Supprime définitivement le compte connecté et toutes ses données (fonction Supabase
 * delete-account), le retire de Brevo et de PostHog, puis le déconnecte.
 */
export async function deleteAccount(confirmation: string): Promise<ActionResult> {
  if (confirmation.trim().toUpperCase() !== ACCOUNT_DELETION_CONFIRMATION) {
    return { success: false, error: `Écrivez ${ACCOUNT_DELETION_CONFIRMATION} pour confirmer` }
  }

  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }

  const supabase = await createClient()
  try {
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: ACCOUNT_DELETION_CONFIRMATION },
    })
    if (error) {
      const detail =
        error instanceof FunctionsHttpError
          ? ((await error.context.json().catch(() => null)) as { error?: string } | null)?.error
          : null
      return { success: false, error: detail ?? 'Suppression impossible pour le moment : réessayez, ou écrivez à support@filonea.fr.' }
    }
  } catch (error) {
    captureServerError(error, user.id, { action: 'delete_account' })
    return { success: false, error: 'Suppression impossible pour le moment : réessayez, ou écrivez à support@filonea.fr.' }
  }

  // Le compte n'existe plus : le reste ne doit pas bloquer la personne
  if (user.email) await removeBrevoContact(user.email).catch(() => false)
  // L'événement ne recrée pas de personne PostHog ; la personne et ses événements sont ensuite effacés
  after(async () => {
    try {
      await getPostHogServer()?.captureImmediate({
        distinctId: user.id,
        event: 'account_deleted',
        properties: { $process_person_profile: false },
      })
    } catch {
      // Un événement manqué ne doit pas empêcher l'effacement
    }
    await erasePostHogPerson(user.id).catch(() => false)
  })
  await supabase.auth.signOut().catch(() => undefined)

  redirect('/login?compte=supprime')
}
