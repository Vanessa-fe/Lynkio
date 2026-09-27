import { createClient } from '@/lib/supabase/server'
import type { ReminderPriority, ReminderWithRelations } from '@/types'

const REMINDER_SELECT = `
  *,
  contact:contacts(*),
  agency:agencies(*),
  company:companies(id, name)
`

export async function getReminders(options?: {
  limit?: number
  offset?: number
  contactId?: string
  agencyId?: string
  companyId?: string
  priority?: ReminderPriority
  includeCompleted?: boolean
}): Promise<ReminderWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  let query = supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('user_id', user.id)
    .order('due_at', { ascending: true })

  // Filtres
  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }

  if (options?.agencyId) {
    query = query.eq('agency_id', options.agencyId)
  }

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

export async function getReminderById(reminderId: string): Promise<ReminderWithRelations | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('id', reminderId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching reminder:', error)
    return null
  }

  return data as ReminderWithRelations
}

export async function getContactReminders(contactId: string): Promise<ReminderWithRelations[]> {
  return getReminders({ contactId })
}

export async function getAgencyReminders(agencyId: string): Promise<ReminderWithRelations[]> {
  return getReminders({ agencyId })
}

/**
 * Relances d'une entreprise, terminées comprises (la fiche montre l'historique)
 */
export async function getCompanyReminders(companyId: string): Promise<ReminderWithRelations[]> {
  return getReminders({ companyId, includeCompleted: true })
}

export async function getRemindersCount(options?: {
  contactId?: string
  agencyId?: string
  priority?: ReminderPriority
  includeCompleted?: boolean
}): Promise<number> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return 0
  }

  let query = supabase
    .from('reminders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }

  if (options?.agencyId) {
    query = query.eq('agency_id', options.agencyId)
  }

  if (options?.priority) {
    query = query.eq('priority', options.priority)
  }

  if (!options?.includeCompleted) {
    query = query.is('completed_at', null)
  }

  const { count } = await query

  return count ?? 0
}

export async function getOverdueReminders(): Promise<ReminderWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('user_id', user.id)
    .is('completed_at', null)
    .lt('due_at', now)
    .order('due_at', { ascending: true })

  if (error) {
    console.error('Error fetching overdue reminders:', error)
    return []
  }

  return (data || []) as ReminderWithRelations[]
}

export async function getDueTodayReminders(): Promise<ReminderWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('user_id', user.id)
    .is('completed_at', null)
    .gte('due_at', startOfDay.toISOString())
    .lte('due_at', endOfDay.toISOString())
    .order('due_at', { ascending: true })

  if (error) {
    console.error('Error fetching today reminders:', error)
    return []
  }

  return (data || []) as ReminderWithRelations[]
}

export async function getUpcomingReminders(days: number = 7): Promise<ReminderWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const now = new Date()
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('user_id', user.id)
    .is('completed_at', null)
    .gte('due_at', now.toISOString())
    .lte('due_at', future.toISOString())
    .order('due_at', { ascending: true })

  if (error) {
    console.error('Error fetching upcoming reminders:', error)
    return []
  }

  return (data || []) as ReminderWithRelations[]
}

export async function getHighPriorityReminders(): Promise<ReminderWithRelations[]> {
  return getReminders({ priority: 'high', includeCompleted: false })
}

export async function getCompletedReminders(options?: {
  limit?: number
}): Promise<ReminderWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  let query = supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching completed reminders:', error)
    return []
  }

  return (data || []) as ReminderWithRelations[]
}

/**
 * Relances d'agences dues aujourd'hui ou en retard (non complétées).
 * Utilisé par la section "Aujourd'hui" de la page /agencies.
 */
export async function getTodayAgencyReminders(): Promise<ReminderWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const now = new Date()
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  const { data, error } = await supabase
    .from('reminders')
    .select(REMINDER_SELECT)
    .eq('user_id', user.id)
    .not('agency_id', 'is', null)
    .is('completed_at', null)
    .lte('due_at', endOfDay.toISOString())
    .order('due_at', { ascending: true })

  if (error) {
    console.error('Error fetching today agency reminders:', error)
    return []
  }

  return (data || []) as ReminderWithRelations[]
}
