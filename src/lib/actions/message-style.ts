'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { STYLE_CHANNELS, type StyleChannel } from '@/lib/message-style'
import { rememberWrittenMessage } from '@/lib/style-memory'

type ActionResult<T = void> = {
  success: boolean
  error?: string
  data?: T
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TEXT_LENGTH = 6000

/**
 * Message validé dans la fenêtre « Préparer un message » (enregistré ou copié) : gardé comme exemple
 * du style de la freelance s'il est à elle (réécrit, pas le brouillon de Sophie tel quel)
 */
export async function rememberMessageStyle(
  channel: StyleChannel,
  text: string
): Promise<ActionResult<{ remembered: boolean }>> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    if (!STYLE_CHANNELS.includes(channel)) return { success: false, error: 'Canal inconnu' }
    if (typeof text !== 'string' || text.length > MAX_TEXT_LENGTH) return { success: false, error: 'Message trop long' }

    const supabase = await createClient()
    const remembered = await rememberWrittenMessage(supabase, user.id, channel, text)
    if (remembered) revalidatePath('/settings/messages')
    return { success: true, data: { remembered } }
  } catch (error) {
    console.error('Remember message style error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/** Oublie un message modèle (Réglages > Messages) */
export async function deleteStyleExample(exampleId: string): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    if (!UUID.test(exampleId)) return { success: false, error: 'Exemple introuvable' }

    const supabase = await createClient()
    const { error } = await supabase.from('message_style_examples').delete().eq('id', exampleId).eq('user_id', user.id)
    if (error) {
      console.error('Delete style example error:', error)
      return { success: false, error: 'Impossible d’oublier ce message' }
    }

    revalidatePath('/settings/messages')
    return { success: true }
  } catch (error) {
    console.error('Delete style example error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/** Oublie tous les messages modèles */
export async function clearStyleExamples(): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase.from('message_style_examples').delete().eq('user_id', user.id)
    if (error) {
      console.error('Clear style examples error:', error)
      return { success: false, error: 'Impossible d’oublier ces messages' }
    }

    revalidatePath('/settings/messages')
    return { success: true }
  } catch (error) {
    console.error('Clear style examples error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
