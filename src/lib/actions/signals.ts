'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

type ActionResult = { success: boolean; error?: string }

const idSchema = z.string().uuid()

/**
 * « Ce signal est faux » (ou « Rétablir ») : le signal reste visible sur la fiche, mais ne compte
 * plus dans le score. La base recalcule aussitôt le score de l'entreprise (rescore_on_signal_change).
 */
export async function setSignalInvalidated(signalId: string, invalidated: boolean): Promise<ActionResult> {
  const parsed = idSchema.safeParse(signalId)
  if (!parsed.success) return { success: false, error: 'Signal introuvable' }

  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_signals')
    .update({ invalidated_at: invalidated ? new Date().toISOString() : null })
    .eq('id', parsed.data)
    .eq('user_id', user.id)
    .select('company_id')
    .maybeSingle()

  if (error || !data) {
    if (error) console.error('Invalidate signal error:', error)
    return { success: false, error: 'Impossible de modifier ce signal' }
  }

  revalidatePath(`/companies/${data.company_id}`)
  revalidatePath('/companies')
  return { success: true }
}
