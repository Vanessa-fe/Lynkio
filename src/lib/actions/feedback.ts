'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { notifyFeedback } from '@/lib/brevo'
import { feedbackSchema, type FeedbackInput } from '@/lib/validations/feedback'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'

type ActionResult = { success: boolean; error?: string }

// Assez pour tout dire, trop peu pour remplir la boîte de l'équipe
const MAX_FEEDBACK_PER_HOUR = 10

/**
 * Envoie un message de la boîte à idées : enregistré, et transmis à l'équipe par e-mail
 */
export async function sendFeedback(input: FeedbackInput): Promise<ActionResult> {
  try {
    const { kind, message, page } = feedbackSchema.parse(input)
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { data: allowed, error: limitError } = await supabase.rpc('hit_my_rate_limit', {
      p_action: 'feedback',
      p_max: MAX_FEEDBACK_PER_HOUR,
      p_window_seconds: 3600,
    })
    if (limitError) throw limitError
    if (!allowed) return { success: false, error: 'Beaucoup de messages en une heure : réessayez un peu plus tard.' }

    const { error } = await supabase.from('feedback').insert({ user_id: user.id, kind, message, page: page ?? null })
    if (error) throw error

    notifyFeedback({ email: user.email, kind, message, page: page ?? null })
    captureServerEvent(user.id, 'feedback_sent', { kind })
    revalidatePath('/ideas')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) return { success: false, error: error.errors[0]?.message ?? 'Message invalide' }
    captureServerError(error, undefined, { action: 'sendFeedback' })
    return { success: false, error: 'Impossible d\'envoyer votre message pour le moment : réessayez.' }
  }
}
