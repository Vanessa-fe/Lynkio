import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { normalizeLinkedinProfileUrl } from '@/lib/validations/company'
import type { Database } from '@/types/database'

export type WaalaxyContact = { linkedin_url: string | null; email: string | null }

/**
 * Contacts exportables vers Waalaxy : profil LinkedIn renseigné, pas d'opposition
 * à la prospection, entreprise dans une étape en cours (ni gagnée, ni perdue,
 * ni hors cible) ou sans étape.
 * Avec une liste : toutes les personnes de la liste (profil renseigné, pas d'opposition),
 * quelle que soit l'étape, puisqu'on les a choisies une à une.
 */
export async function getWaalaxyContacts(
  supabase: SupabaseClient<Database>,
  userId: string,
  listId?: string
): Promise<WaalaxyContact[]> {
  if (listId) {
    const { data, error } = await supabase
      .from('prospect_list_members')
      .select('contact:company_contacts!inner(linkedin_url, email, opted_out_at)')
      .eq('user_id', userId)
      .eq('list_id', listId)

    if (error) {
      console.error('Waalaxy list contacts error:', error)
      return []
    }

    return (data ?? [])
      .map((member) => member.contact as unknown as WaalaxyContact & { opted_out_at: string | null })
      .filter((contact) => contact.linkedin_url && !contact.opted_out_at)
      .map(({ linkedin_url, email }) => ({ linkedin_url, email }))
  }

  const { data, error } = await supabase
    .from('company_contacts')
    .select('linkedin_url, email, company:companies!inner(stage:pipeline_stages(kind))')
    .eq('user_id', userId)
    .not('linkedin_url', 'is', null)
    .is('opted_out_at', null)

  if (error) {
    console.error('Waalaxy contacts error:', error)
    return []
  }

  return (data ?? [])
    .filter((contact) => {
      const company = contact.company as { stage: { kind: string } | null } | null
      const kind = company?.stage?.kind
      return !kind || kind === 'open'
    })
    .map(({ linkedin_url, email }) => ({ linkedin_url, email }))
}

/**
 * Nombre de personnes que contiendra l'export Waalaxy (affiché sur la page Import / Export)
 */
export async function countWaalaxyContacts(): Promise<number> {
  const user = await getAuthUser()
  if (!user) return 0
  const supabase = await createClient()
  const contacts = await getWaalaxyContacts(supabase, user.id)
  return contacts.filter((contact) => normalizeLinkedinProfileUrl(contact.linkedin_url)).length
}
