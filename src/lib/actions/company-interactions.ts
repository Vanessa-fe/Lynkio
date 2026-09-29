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
