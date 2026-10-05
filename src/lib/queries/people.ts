import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { contactDisplayName, normalizeLinkedinProfileUrl } from '@/lib/validations/company'
import type { Company, CompanyContact, ContactOutreach, OutreachStatus, ProspectList } from '@/types'

export type PersonRow = Pick<
  CompanyContact,
  'id' | 'first_name' | 'last_name' | 'role' | 'email' | 'linkedin_url' | 'is_decision_maker' | 'opted_out_at' | 'created_at'
> & {
  // Sa fiche : celle de son entreprise, ou la sienne si elle est seule
  company: Pick<
    Company,
    'id' | 'name' | 'kind' | 'size_category' | 'city' | 'stage_id' | 'next_action' | 'last_interaction_at'
  >
  // Statut déduit de ses échanges
  outreach: { status: OutreachStatus; lastSentAt: string | null; lastReplyAt: string | null }
  // Listes dont elle fait partie
  listIds: string[]
}

export type ProspectListWithCount = Pick<ProspectList, 'id' | 'name'> & { count: number }

export type OrganizationOption = Pick<Company, 'id' | 'name' | 'city'>

/**
 * Toutes les personnes suivies, seules ou dans une entreprise, les plus récentes d'abord,
 * avec leur statut de prospection et leurs listes
 */
export async function getPeople(limit = 500): Promise<PersonRow[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const [contactsResult, outreachResult, membersResult] = await Promise.all([
    supabase
      .from('company_contacts')
      .select(
        `id, first_name, last_name, role, email, linkedin_url, is_decision_maker, opted_out_at, created_at,
         company:companies!inner(id, name, kind, size_category, city, stage_id, next_action, last_interaction_at)`
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase.from('contact_outreach').select('contact_id, status, last_sent_at, last_reply_at').eq('user_id', user.id),
    supabase.from('prospect_list_members').select('list_id, contact_id').eq('user_id', user.id),
  ])

  if (contactsResult.error || !contactsResult.data) {
    if (contactsResult.error) console.error('People query error:', contactsResult.error)
    return []
  }
  if (outreachResult.error) console.error('Outreach query error:', outreachResult.error)
  if (membersResult.error) console.error('List members query error:', membersResult.error)

  const outreachByContact = new Map(
    (outreachResult.data ?? []).map((row: Pick<ContactOutreach, 'contact_id' | 'status' | 'last_sent_at' | 'last_reply_at'>) => [
      row.contact_id,
      row,
    ])
  )
  const listsByContact = new Map<string, string[]>()
  for (const member of membersResult.data ?? []) {
    listsByContact.set(member.contact_id, [...(listsByContact.get(member.contact_id) ?? []), member.list_id])
  }

  return contactsResult.data.map((contact) => {
    const outreach = outreachByContact.get(contact.id)
    return {
      ...(contact as Omit<PersonRow, 'outreach' | 'listIds'>),
      outreach: {
        status: outreach?.status ?? (contact.opted_out_at ? 'do_not_contact' : 'to_contact'),
        lastSentAt: outreach?.last_sent_at ?? null,
        lastReplyAt: outreach?.last_reply_at ?? null,
      },
      listIds: listsByContact.get(contact.id) ?? [],
    }
  })
}

/**
 * Listes de prospects, par ordre alphabétique, avec leur nombre de personnes
 */
export async function getProspectLists(): Promise<ProspectListWithCount[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('prospect_lists')
    .select('id, name, members:prospect_list_members(count)')
    .eq('user_id', user.id)
    .order('name')

  if (error) console.error('Prospect lists query error:', error)
  return (data ?? []).map(({ id, name, members }) => ({
    id,
    name,
    count: (members as unknown as { count: number }[])[0]?.count ?? 0,
  }))
}

/**
 * Statut de chaque personne d'une fiche, pour la carte Contacts
 */
export async function getContactsOutreach(companyId: string): Promise<Record<string, PersonRow['outreach']>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contact_outreach')
    .select('contact_id, status, last_sent_at, last_reply_at')
    .eq('company_id', companyId)

  if (error) console.error('Contacts outreach query error:', error)
  return Object.fromEntries(
    (data ?? [])
      .filter((row) => row.contact_id && row.status)
      .map((row) => [
        row.contact_id!,
        { status: row.status!, lastSentAt: row.last_sent_at, lastReplyAt: row.last_reply_at },
      ])
  )
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

/**
 * Personne déjà suivie avec ce profil LinkedIn (le profil est enregistré au format
 * standard, voir normalizeLinkedinProfileUrl)
 */
export async function findContactByLinkedin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  linkedinUrl: string | null | undefined
): Promise<{ name: string; companyId: string } | null> {
  const profile = normalizeLinkedinProfileUrl(linkedinUrl)
  if (!profile) return null

  const { data } = await supabase
    .from('company_contacts')
    .select('first_name, last_name, company_id')
    .eq('user_id', userId)
    .eq('linkedin_url', profile)
    .limit(1)
    .maybeSingle()

  return data ? { name: contactDisplayName(data), companyId: data.company_id } : null
}

/**
 * Pour la page « Ajouter une personne » pré-remplie depuis LinkedIn
 */
export async function getContactByLinkedin(linkedinUrl: string | null | undefined) {
  const user = await getAuthUser()
  if (!user) return null
  return findContactByLinkedin(await createClient(), user.id, linkedinUrl)
}
