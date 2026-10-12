import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

export type ListOverview = {
  id: string
  name: string
  createdAt: string
  count: number
  // Personnes avec un profil LinkedIn et qui acceptent d'être contactées
  linkedinCount: number
  // Personnes de la liste dont l'envoi LinkedIn est en cours (pas encore répondu ni arrêté)
  inProgressCount: number
}

/**
 * Listes de prospects, par ordre alphabétique, avec ce qu'on peut en faire
 */
export async function getListsOverview(): Promise<ListOverview[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const [listsResult, sequencesResult] = await Promise.all([
    supabase
      .from('prospect_lists')
      .select('id, name, created_at, members:prospect_list_members(contact:company_contacts!inner(linkedin_url, opted_out_at))')
      .eq('user_id', user.id)
      .order('name'),
    supabase
      .from('linkedin_sequences')
      .select('list_id')
      .eq('user_id', user.id)
      .not('list_id', 'is', null)
      .not('status', 'in', '(replied,stopped)'),
  ])

  if (listsResult.error) console.error('Lists overview error:', listsResult.error)
  if (sequencesResult.error) console.error('Lists sequences error:', sequencesResult.error)

  const inProgress = new Map<string, number>()
  for (const { list_id } of sequencesResult.data ?? []) {
    if (list_id) inProgress.set(list_id, (inProgress.get(list_id) ?? 0) + 1)
  }

  return (listsResult.data ?? []).map((list) => {
    const members = (list.members ?? []) as unknown as {
      contact: { linkedin_url: string | null; opted_out_at: string | null }
    }[]
    return {
      id: list.id,
      name: list.name,
      createdAt: list.created_at,
      count: members.length,
      linkedinCount: members.filter(({ contact }) => contact.linkedin_url && !contact.opted_out_at).length,
      inProgressCount: inProgress.get(list.id) ?? 0,
    }
  })
}
