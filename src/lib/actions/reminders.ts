'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  createReminderSchema,
  updateReminderSchema,
  type CreateReminderInput,
  type UpdateReminderInput,
} from '@/lib/validations/reminder'

type ActionResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
}

type ReminderTargets = {
  company_id?: string | null
}

/**
 * Rafraîchit les pages qui affichent la relance : liste, tableau de bord et fiche ciblée
 */
function revalidateReminderPages(targets: ReminderTargets) {
  revalidatePath('/reminders')
  revalidatePath('/dashboard')
  if (targets.company_id) {
    revalidatePath(`/companies/${targets.company_id}`)
  }
}

export async function createReminder(
  input: CreateReminderInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient()

    // Vérifier l'authentification
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Non authentifié' }
    }

    // Valider les données
    const validated = createReminderSchema.parse(input)

    // Si une entreprise est fournie, vérifier qu'elle appartient à l'utilisateur
    if (validated.companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('id', validated.companyId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!company) {
        return { success: false, error: 'Entreprise non trouvée' }
      }
    }

    // Préparer les données pour l'insertion
    const insertData = {
      user_id: user.id,
      company_id: validated.companyId,
      title: validated.title,
      due_at: validated.dueAt,
      priority: validated.priority,
    }

    const { data: reminderData, error: insertError } = await supabase
      .from('reminders')
      .insert(insertData as never)
      .select('id')
      .single()

    if (insertError) {
      console.error('Error creating reminder:', insertError)
      return { success: false, error: 'Erreur lors de la création de la relance' }
    }

    revalidateReminderPages({
      company_id: validated.companyId,
    })

    return {
      success: true,
      data: { id: (reminderData as { id: string }).id },
    }
  } catch (error) {
    console.error('Error in createReminder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

export async function updateReminder(
  reminderId: string,
  input: UpdateReminderInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Non authentifié' }
    }

    // Valider les données
    const validated = updateReminderSchema.parse(input)

    // Vérifier que la relance appartient à l'utilisateur
    const { data: reminder } = await supabase
      .from('reminders')
      .select('id, company_id')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .single()

    if (!reminder) {
      return { success: false, error: 'Relance non trouvée' }
    }

    // Si une entreprise est fournie, vérifier qu'elle appartient à l'utilisateur
    if (validated.companyId) {
      const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('id', validated.companyId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!company) {
        return { success: false, error: 'Entreprise non trouvée' }
      }
    }

    // Préparer les données pour la mise à jour
    const updateData: Record<string, unknown> = {}

    if (validated.companyId !== undefined) updateData.company_id = validated.companyId
    if (validated.title !== undefined) updateData.title = validated.title
    if (validated.dueAt !== undefined) updateData.due_at = validated.dueAt
    if (validated.priority !== undefined) updateData.priority = validated.priority

    const { error: updateError } = await supabase
      .from('reminders')
      .update(updateData as never)
      .eq('id', reminderId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating reminder:', updateError)
      return { success: false, error: 'Erreur lors de la mise à jour de la relance' }
    }

    revalidateReminderPages(reminder as ReminderTargets)

    return { success: true }
  } catch (error) {
    console.error('Error in updateReminder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

export async function completeReminder(reminderId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Non authentifié' }
    }

    // Vérifier que la relance appartient à l'utilisateur
    const { data: reminder } = await supabase
      .from('reminders')
      .select('company_id')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .single()

    if (!reminder) {
      return { success: false, error: 'Relance non trouvée' }
    }

    const { error: updateError } = await supabase
      .from('reminders')
      .update({ completed_at: new Date().toISOString() } as never)
      .eq('id', reminderId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error completing reminder:', updateError)
      return { success: false, error: 'Erreur lors du marquage de la relance' }
    }

    revalidateReminderPages(reminder as ReminderTargets)

    return { success: true }
  } catch (error) {
    console.error('Error in completeReminder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

export async function uncompleteReminder(reminderId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Non authentifié' }
    }

    // Vérifier que la relance appartient à l'utilisateur
    const { data: reminder } = await supabase
      .from('reminders')
      .select('company_id')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .single()

    if (!reminder) {
      return { success: false, error: 'Relance non trouvée' }
    }

    const { error: updateError } = await supabase
      .from('reminders')
      .update({ completed_at: null } as never)
      .eq('id', reminderId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error uncompleting reminder:', updateError)
      return { success: false, error: 'Erreur lors de la réouverture de la relance' }
    }

    revalidateReminderPages(reminder as ReminderTargets)

    return { success: true }
  } catch (error) {
    console.error('Error in uncompleteReminder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}

export async function deleteReminder(reminderId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'Non authentifié' }
    }

    // Vérifier que la relance appartient à l'utilisateur
    const { data: reminder } = await supabase
      .from('reminders')
      .select('company_id')
      .eq('id', reminderId)
      .eq('user_id', user.id)
      .single()

    if (!reminder) {
      return { success: false, error: 'Relance non trouvée' }
    }

    const { error: deleteError } = await supabase
      .from('reminders')
      .delete()
      .eq('id', reminderId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Error deleting reminder:', deleteError)
      return { success: false, error: 'Erreur lors de la suppression de la relance' }
    }

    revalidateReminderPages(reminder as ReminderTargets)

    return { success: true }
  } catch (error) {
    console.error('Error in deleteReminder:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}
