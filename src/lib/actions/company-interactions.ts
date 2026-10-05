'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  companyInteractionSchema,
  type CompanyInteractionInput,
} from '@/lib/validations/company'
import { getAuthUser } from '@/lib/supabase/auth'

type ActionResult = {
  success: boolean
  error?: string
}

/**
 * Enregistre un échange. La date du dernier échange de l'entreprise est mise à jour
 * par un trigger de la base, uniquement pour les échanges effectués (pas les brouillons).
 */
export async function createCompanyInteraction(
  input: CompanyInteractionInput
): Promise<ActionResult> {
  try {
    const validated = companyInteractionSchema.parse(input)
    const supabase = await createClient()

    const user = await getAuthUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const { error } = await supabase.from('company_interactions').insert({
      user_id: user.id,
      company_id: validated.companyId,
      contact_id: validated.contactId ?? null,
      type: validated.type,
      status: validated.status,
      // Une note n'a pas de sens : ni entrant ni sortant
      direction: validated.type === 'note' ? null : (validated.direction ?? null),
      subject: validated.subject,
      content: validated.content,
      occurred_at: validated.occurredAt.toISOString(),
    })

    if (error) {
      console.error('Create company interaction error:', error)
      return { success: false, error: 'Impossible d\'enregistrer l\'échange' }
    }

    revalidatePath(`/companies/${validated.companyId}`)
    revalidatePath('/companies')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Données invalides' }
    }
    console.error('Create company interaction error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

export async function deleteCompanyInteraction(
  interactionId: string,
  companyId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('company_interactions')
      .delete()
      .eq('id', interactionId)
      .eq('company_id', companyId)

    if (error) {
      console.error('Delete company interaction error:', error)
      return { success: false, error: 'Impossible de supprimer l\'échange' }
    }

    revalidatePath(`/companies/${companyId}`)
    return { success: true }
  } catch (error) {
    console.error('Delete company interaction error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Note en un clic un envoi ou une réponse avec une personne, daté de maintenant.
 * La base en déduit son statut (vue contact_outreach) et fait avancer l'étape de sa
 * fiche (trigger advance_stage_on_exchange).
 */
export async function logContactExchange(
  contactId: string,
  exchange: { type: 'linkedin_message' | 'email'; direction: 'outgoing' | 'incoming' }
): Promise<ActionResult> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const { data: contact } = await supabase
      .from('company_contacts')
      .select('company_id, opted_out_at')
      .eq('id', contactId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!contact) return { success: false, error: 'Personne introuvable' }
    if (contact.opted_out_at && exchange.direction === 'outgoing') {
      return { success: false, error: 'Cette personne ne souhaite plus être contactée' }
    }

    const { error } = await supabase.from('company_interactions').insert({
      user_id: user.id,
      company_id: contact.company_id,
      contact_id: contactId,
      type: exchange.type,
      direction: exchange.direction,
      status: 'done',
      occurred_at: new Date().toISOString(),
    })

    if (error) {
      console.error('Log contact exchange error:', error)
      return { success: false, error: 'Impossible d\'enregistrer l\'échange' }
    }

    revalidatePath('/people')
    revalidatePath('/companies')
    revalidatePath(`/companies/${contact.company_id}`)
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    console.error('Log contact exchange error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Le brouillon a été envoyé : il devient un échange effectué, daté de maintenant.
 * La base met alors à jour la date du dernier échange de l'entreprise (trigger).
 */
export async function markCompanyInteractionSent(
  interactionId: string,
  companyId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('company_interactions')
      .update({ status: 'done', occurred_at: new Date().toISOString() })
      .eq('id', interactionId)
      .eq('company_id', companyId)
      .eq('status', 'draft')

    if (error) {
      console.error('Mark company interaction sent error:', error)
      return { success: false, error: 'Impossible de marquer le message comme envoyé' }
    }

    revalidatePath(`/companies/${companyId}`)
    revalidatePath('/companies')
    return { success: true }
  } catch (error) {
    console.error('Mark company interaction sent error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
