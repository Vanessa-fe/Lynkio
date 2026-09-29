import { createClient } from '@/lib/supabase/server'
import type { ReminderPriority, ReminderWithRelations } from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'

const REMINDER_SELECT = `
  *,
  company:companies(id, name)
`

export async function getReminders(options?: {
  limit?: number
  offset?: number
  companyId?: string
  priority?: ReminderPriority
  includeCompleted?: boolean
}): Promise<ReminderWithRelations[]> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return []
  }

  let query = supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('user_id', user.id)
    .order('due_at', { ascending: true })

  // Filtres
  if (options?.companyId) {
    query = query.eq('company_id', options.companyId)
  }

  if (options?.priority) {
    query = query.eq('priority', options.priority)
  }

  if (!options?.includeCompleted) {
    query = query.is('completed_at', null)
  }

  // Pagination
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 10) - 1)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching reminders:', error)
    return []
  }

  return (data || []) as ReminderWithRelations[]
}

/**
 * Relances d'une entreprise, terminées comprises (la fiche montre l'historique)
 */
export async function getCompanyReminders(companyId: string): Promise<ReminderWithRelations[]> {
  return getReminders({ companyId, includeCompleted: true })
}

export async function getRemindersCount(options?: {
  priority?: ReminderPriority
  includeCompleted?: boolean
}): Promise<number> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return 0
  }

  let query = supabase
    .from('reminders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (options?.priority) {
    query = query.eq('priority', options.priority)
  }

  if (!options?.includeCompleted) {
    query = query.is('completed_at', null)
  }

  const { count } = await query

  return count ?? 0
}
