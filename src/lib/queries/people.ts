import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { Company, CompanyContact } from '@/types'

export type PersonRow = Pick<
  CompanyContact,
  'id' | 'first_name' | 'last_name' | 'role' | 'email' | 'linkedin_url' | 'is_decision_maker' | 'opted_out_at' | 'created_at'
> & {
  // Sa fiche : celle de son entreprise, ou la sienne si elle est seule
  company: Pick<
    Company,
    'id' | 'name' | 'kind' | 'size_category' | 'city' | 'stage_id' | 'next_action' | 'last_interaction_at'
  >
}

export type OrganizationOption = Pick<Company, 'id' | 'name' | 'city'>

/**
 * Toutes les personnes suivies, seules ou dans une entreprise, les plus récentes d'abord
 */
export async function getPeople(limit = 500): Promise<PersonRow[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('company_contacts')
    .select(
      `id, first_name, last_name, role, email, linkedin_url, is_decision_maker, opted_out_at, created_at,
       company:companies!inner(id, name, kind, size_category, city, stage_id, next_action, last_interaction_at)`
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    if (error) console.error('People query error:', error)
    return []
  }

  return data as PersonRow[]
}

/**
 * Entreprises proposées quand on rattache une personne (les personnes seules en sont exclues)
 */
export async function getOrganizationOptions(): Promise<OrganizationOption[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, city')
    .eq('user_id', user.id)
    .eq('kind', 'organization')
    .order('name')
    .limit(1000)

  if (error) console.error('Organization options error:', error)
  return data ?? []
}
