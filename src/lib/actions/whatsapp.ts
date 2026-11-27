'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerEvent } from '@/lib/posthog-server'
import { NO_ACCESS_MESSAGE, PRO_ONLY_MESSAGE } from '@/lib/billing'
import { getCurrentPlan } from '@/lib/queries/billing'
import { readWhatsappUsage } from '@/lib/queries/whatsapp'
import { WHATSAPP_CAP_MESSAGE, WHATSAPP_MAX_LENGTH } from '@/lib/whatsapp'
import { rememberWrittenMessage } from '@/lib/style-memory'

type ActionResult<T = void> = {
  success: boolean
  error?: string
  data?: T
}

type Supabase = Awaited<ReturnType<typeof createClient>>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** WhatsApp : offre Pro (essai compris) */
async function whatsappDenied(): Promise<string | null> {
  const plan = await getCurrentPlan()
  if (!plan) return NO_ACCESS_MESSAGE
  return plan === 'pro' ? null : PRO_ONLY_MESSAGE
}

function cleanContent(content: string): string | null {
  const text = content.replace(/\r\n/g, '\n').trim()
  if (!text) return null
  return text.slice(0, WHATSAPP_MAX_LENGTH)
}

/** Le contact peut-il recevoir un message WhatsApp ? (numéro connu, pas d'opposition) */
async function reachableContact(supabase: Supabase, userId: string, contactId: string) {
  const { data: contact } = await supabase
    .from('company_contacts')
    .select('id, company_id, phone, opted_out_at')
    .eq('id', contactId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!contact) return { error: 'Contact introuvable' } as const
  if (contact.opted_out_at) return { error: 'Cette personne a demandé à ne plus être contactée' } as const
  if (!contact.phone) return { error: 'Ce contact n’a pas de numéro de téléphone' } as const
  return { contact } as const
}

/**
 * Enregistre le message WhatsApp préparé (ou modifié) comme brouillon de l'échange avec ce contact.
 * Un seul brouillon par contact : celui qui existe est mis à jour.
 */
export async function saveWhatsappDraft(input: {
  contactId: string
  content: string
  interactionId?: string | null
}): Promise<ActionResult<{ interactionId: string }>> {
  try {
    const denied = await whatsappDenied()
    if (denied) return { success: false, error: denied }

    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    if (!UUID.test(input.contactId)) return { success: false, error: 'Contact introuvable' }

    const content = cleanContent(input.content)
    if (!content) return { success: false, error: 'Le message est vide' }

    const supabase = await createClient()
    const reachable = await reachableContact(supabase, user.id, input.contactId)
    if ('error' in reachable) return { success: false, error: reachable.error }
    const { contact } = reachable

    // Brouillon à mettre à jour : celui indiqué, sinon le dernier brouillon WhatsApp de ce contact
    let draftId = input.interactionId && UUID.test(input.interactionId) ? input.interactionId : null
    if (!draftId) {
      const { data: existing } = await supabase
        .from('company_interactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_id', contact.id)
        .eq('type', 'whatsapp')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      draftId = existing?.id ?? null
    }

    if (draftId) {
      const { data, error } = await supabase
        .from('company_interactions')
        .update({ content, occurred_at: new Date().toISOString() })
        .eq('id', draftId)
        .eq('user_id', user.id)
        .eq('type', 'whatsapp')
        .eq('status', 'draft')
        .select('id')
        .maybeSingle()
      if (error) {
        console.error('Save WhatsApp draft error:', error)
        return { success: false, error: 'Impossible d’enregistrer le message' }
      }
      if (data) {
        revalidatePath(`/companies/${contact.company_id}`)
        return { success: true, data: { interactionId: data.id } }
      }
      // Brouillon disparu entre-temps (envoyé ou supprimé) : on en crée un nouveau
    }

    const { data, error } = await supabase
      .from('company_interactions')
      .insert({
        user_id: user.id,
        company_id: contact.company_id,
        contact_id: contact.id,
        type: 'whatsapp',
        direction: 'outgoing',
        status: 'draft',
        content,
        occurred_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('Create WhatsApp draft error:', error)
      return { success: false, error: 'Impossible d’enregistrer le message' }
    }

    revalidatePath(`/companies/${contact.company_id}`)
    return { success: true, data: { interactionId: data.id } }
  } catch (error) {
    console.error('Save WhatsApp draft error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * « C'est envoyé » : l'utilisatrice a envoyé le message elle-même dans WhatsApp. Le brouillon devient
 * un échange effectué, daté de maintenant, avec le texte tel qu'il a été ouvert dans WhatsApp.
 * La base fait alors avancer la fiche (trigger advance_stage_on_exchange : contacté, puis relancé).
 * Refusé au-delà du plafond du jour (heure de Paris). Un message réécrit par la freelance devient un
 * exemple de son style pour les prochains (remembered).
 */
export async function markWhatsappSent(
  interactionId: string,
  content: string
): Promise<ActionResult<{ used: number; limit: number; remembered: boolean }>> {
  try {
    const denied = await whatsappDenied()
    if (denied) return { success: false, error: denied }

    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    if (!UUID.test(interactionId)) return { success: false, error: 'Message introuvable' }

    const text = cleanContent(content)
    if (!text) return { success: false, error: 'Le message est vide' }

    const supabase = await createClient()
    const { data: draft } = await supabase
      .from('company_interactions')
      .select('id, company_id, contact_id')
      .eq('id', interactionId)
      .eq('user_id', user.id)
      .eq('type', 'whatsapp')
      .eq('status', 'draft')
      .maybeSingle()
    if (!draft) return { success: false, error: 'Ce message a déjà été noté comme envoyé, ou a été supprimé' }
    if (!draft.contact_id) return { success: false, error: 'Contact introuvable' }

    const reachable = await reachableContact(supabase, user.id, draft.contact_id)
    if ('error' in reachable) return { success: false, error: reachable.error }

    const { used, limit } = await readWhatsappUsage(supabase, user.id)
    if (used >= limit) return { success: false, error: WHATSAPP_CAP_MESSAGE }

    const { error } = await supabase
      .from('company_interactions')
      .update({ status: 'done', content: text, occurred_at: new Date().toISOString() })
      .eq('id', draft.id)
      .eq('user_id', user.id)
      .eq('status', 'draft')

    if (error) {
      console.error('Mark WhatsApp sent error:', error)
      return { success: false, error: 'Impossible de noter le message comme envoyé' }
    }

    const remembered = await rememberWrittenMessage(supabase, user.id, 'whatsapp', text)
    captureServerEvent(user.id, 'whatsapp_sent', { used: used + 1, limit, style_example: remembered })
    if (remembered) revalidatePath('/settings/messages')

    revalidatePath(`/companies/${draft.company_id}`)
    revalidatePath('/companies')
    revalidatePath('/people')
    revalidatePath('/pipeline')
    revalidatePath('/dashboard')
    return { success: true, data: { used: used + 1, limit, remembered } }
  } catch (error) {
    console.error('Mark WhatsApp sent error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
