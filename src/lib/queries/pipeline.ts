import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { Company, CompanyContact } from '@/types'

export type PipelineCard = Pick<Company, 'id' | 'name' | 'kind' | 'city' | 'score' | 'stage_id'> & {
  // Personnes rattachées à la fiche (pour une personne seule : elle-même)
  contacts: Pick<CompanyContact, 'id' | 'first_name' | 'last_name'>[]
  // Prochaine relance non faite, la plus proche
  nextReminder: { title: string; dueAt: string } | null
}

/**
 * Toutes les fiches du pipeline commercial : entreprises et personnes seules,
 * avec leurs personnes et leur prochaine relance
 */
export async function getPipelineCards(limit = 1000): Promise<PipelineCard[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const [companiesResult, remindersResult] = await Promise.all([
    supabase
      .from('companies')
      .select('id, name, kind, city, score, stage_id, contacts:company_contacts(id, first_name, last_name)')
      .eq('user_id', user.id)
      .order('score', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('reminders')
      .select('company_id, title, due_at')
      .eq('user_id', user.id)
      .is('completed_at', null)
      .not('company_id', 'is', null)
      .order('due_at', { ascending: true }),
  ])

  if (companiesResult.error || !companiesResult.data) {
    if (companiesResult.error) console.error('Pipeline query error:', companiesResult.error)
    return []
  }
  if (remindersResult.error) console.error('Pipeline reminders query error:', remindersResult.error)

  // Les relances arrivent triées par date : la première vue pour une fiche est la plus proche
  const nextByCompany = new Map<string, { title: string; dueAt: string }>()
  for (const reminder of remindersResult.data ?? []) {
    if (reminder.company_id && !nextByCompany.has(reminder.company_id)) {
      nextByCompany.set(reminder.company_id, { title: reminder.title, dueAt: reminder.due_at })
    }
  }

  return companiesResult.data.map(({ contacts, ...company }) => ({
    ...company,
    contacts: contacts ?? [],
    nextReminder: nextByCompany.get(company.id) ?? null,
  }))
}
