'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

type ActionResult<T = void> = {
  success: boolean
  error?: string
  data?: T
}

const UNIQUE_VIOLATION = '23505'
const MAX_NAME_LENGTH = 100
const MAX_CONTACTS_PER_CALL = 500

function cleanName(name: string): string | { error: string } {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Donnez un nom à la liste' }
  if (trimmed.length > MAX_NAME_LENGTH) return { error: 'Le nom de la liste est trop long' }
  return trimmed
}

/**
 * Ajoute des personnes à une liste existante, ou à une nouvelle liste créée à partir
 * du nom tapé (retrouvée si une liste porte déjà ce nom). Une personne déjà dans la
 * liste n'est pas ajoutée deux fois.
 */
export async function addContactsToList(
  target: { listId: string } | { listName: string },
  contactIds: string[]
): Promise<ActionResult<{ listId: string; added: number }>> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    if (contactIds.length === 0) return { success: false, error: 'Sélectionnez au moins une personne' }
    if (contactIds.length > MAX_CONTACTS_PER_CALL) {
      return { success: false, error: `Au plus ${MAX_CONTACTS_PER_CALL} personnes à la fois` }
    }

    const supabase = await createClient()
    let listId: string

    if ('listId' in target) {
      listId = target.listId
    } else {
      const name = cleanName(target.listName)
      if (typeof name !== 'string') return { success: false, error: name.error }

      const { data: lists } = await supabase.from('prospect_lists').select('id, name').eq('user_id', user.id)
      const existing = lists?.find((list) => list.name.trim().toLowerCase() === name.toLowerCase())

      if (existing) {
        listId = existing.id
      } else {
        const { data, error } = await supabase
          .from('prospect_lists')
          .insert({ user_id: user.id, name })
          .select('id')
          .single()
        if (error || !data) {
          console.error('Create prospect list error:', error)
          return { success: false, error: 'Impossible de créer la liste' }
        }
        listId = data.id
      }
    }

    const { data, error } = await supabase
      .from('prospect_list_members')
      .upsert(
        [...new Set(contactIds)].map((contactId) => ({ list_id: listId, contact_id: contactId, user_id: user.id })),
        { onConflict: 'list_id,contact_id', ignoreDuplicates: true }
      )
      .select('contact_id')

    if (error) {
      console.error('Add contacts to list error:', error)
      return { success: false, error: 'Impossible d\'ajouter ces personnes à la liste' }
    }

    revalidatePath('/people')
    return { success: true, data: { listId, added: data?.length ?? 0 } }
  } catch (error) {
    console.error('Add contacts to list error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

export async function removeContactsFromList(listId: string, contactIds: string[]): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('prospect_list_members')
      .delete()
      .eq('user_id', user.id)
      .eq('list_id', listId)
      .in('contact_id', contactIds.slice(0, MAX_CONTACTS_PER_CALL))

    if (error) {
      console.error('Remove contacts from list error:', error)
      return { success: false, error: 'Impossible de retirer ces personnes de la liste' }
    }

    revalidatePath('/people')
    return { success: true }
  } catch (error) {
    console.error('Remove contacts from list error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

export async function renameProspectList(listId: string, newName: string): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const name = cleanName(newName)
    if (typeof name !== 'string') return { success: false, error: name.error }

    const supabase = await createClient()
    const { error } = await supabase.from('prospect_lists').update({ name }).eq('id', listId).eq('user_id', user.id)

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { success: false, error: 'Une liste porte déjà ce nom' }
      console.error('Rename prospect list error:', error)
      return { success: false, error: 'Impossible de renommer la liste' }
    }

    revalidatePath('/people')
    return { success: true }
  } catch (error) {
    console.error('Rename prospect list error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Supprime la liste ; les personnes restent dans Lynkio
 */
export async function deleteProspectList(listId: string): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase.from('prospect_lists').delete().eq('id', listId).eq('user_id', user.id)

    if (error) {
      console.error('Delete prospect list error:', error)
      return { success: false, error: 'Impossible de supprimer la liste' }
    }

    revalidatePath('/people')
    return { success: true }
  } catch (error) {
    console.error('Delete prospect list error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
