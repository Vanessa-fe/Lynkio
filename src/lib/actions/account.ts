'use server'

import { redirect } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { removeBrevoContact } from '@/lib/brevo'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'
import { ACCOUNT_DELETION_CONFIRMATION } from '@/lib/constants/account'

type ActionResult = { success: boolean; error?: string }

/**
 * Supprime définitivement le compte connecté et toutes ses données (fonction Supabase
 * delete-account), le retire de Brevo, puis le déconnecte.
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
      return { success: false, error: detail ?? 'Suppression impossible pour le moment : réessayez, ou écrivez-nous.' }
    }
  } catch (error) {
    captureServerError(error, user.id, { action: 'delete_account' })
    return { success: false, error: 'Suppression impossible pour le moment : réessayez, ou écrivez-nous.' }
  }

  // Le compte n'existe plus : le reste ne doit pas bloquer la personne
  if (user.email) await removeBrevoContact(user.email).catch(() => false)
  captureServerEvent(user.id, 'account_deleted')
  await supabase.auth.signOut().catch(() => undefined)

  redirect('/login?compte=supprime')
}
