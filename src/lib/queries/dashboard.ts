import { createClient } from '@/lib/supabase/server'
import type { DashboardStats, ContactsByStatus, ContactsBySource } from '@/types'

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      totalContacts: 0,
      newContactsThisMonth: 0,
      appointmentsToday: 0,
      overdueReminders: 0,
      revenueThisMonth: 0,
    }
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  // Total contacts
  const { count: totalContacts } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // Nouveaux contacts ce mois
  const { count: newContactsThisMonth } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', startOfMonth.toISOString())

  // Rendez-vous aujourd'hui
  const { count: appointmentsToday } = await supabase
    .from('appointments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('start_at', startOfDay.toISOString())
    .lte('start_at', endOfDay.toISOString())

  // Relances en retard
  const { count: overdueReminders } = await supabase
    .from('reminders')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('completed_at', null)
    .lt('due_at', now.toISOString())

  // Revenu ce mois
  const { data: paymentsData } = await supabase
    .from('payments')
    .select('deposit_amount')
    .eq('user_id', user.id)
    .in('payment_status', ['paid', 'partial'])
    .gte('paid_at', startOfMonth.toISOString())

  const revenueThisMonth = (paymentsData || []).reduce((sum, payment) => {
    // numeric : PostgREST le renvoie en nombre, Number() couvre aussi une éventuelle chaîne
    return sum + Number(payment.deposit_amount ?? 0)
  }, 0)

  return {
    totalContacts: totalContacts ?? 0,
    newContactsThisMonth: newContactsThisMonth ?? 0,
    appointmentsToday: appointmentsToday ?? 0,
    overdueReminders: overdueReminders ?? 0,
    revenueThisMonth,
  }
}

export async function getContactsByStatus(): Promise<ContactsByStatus[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('contacts')
    .select(
      `
      status_id,
      status:contact_statuses(name, color)
    `
    )
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching contacts by status:', error)
    return []
  }

  // Grouper par statut
  const groupedData = (data || []).reduce(
    (acc, contact) => {
      const status = (contact as { status: { name: string; color: string } | null }).status
      if (!status) return acc

      const key = status.name
      if (!acc[key]) {
        acc[key] = {
          statusName: status.name,
          statusColor: status.color,
          count: 0,
        }
      }
      acc[key]!.count++
      return acc
    },
    {} as Record<string, ContactsByStatus>
  )

  return Object.values(groupedData).sort((a, b) => b.count - a.count)
}

export async function getContactsBySource(): Promise<ContactsBySource[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  const { data, error } = await supabase
    .from('contacts')
    .select(
      `
      source_id,
      source:contact_sources(name)
    `
    )
    .eq('user_id', user.id)

  if (error) {
    console.error('Error fetching contacts by source:', error)
    return []
  }

  // Grouper par source
  const groupedData = (data || []).reduce(
    (acc, contact) => {
      const source = (contact as { source: { name: string } | null }).source
      const sourceName = source?.name || 'Sans source'

      if (!acc[sourceName]) {
        acc[sourceName] = {
          sourceName,
          count: 0,
        }
      }
      acc[sourceName]!.count++
      return acc
    },
    {} as Record<string, ContactsBySource>
  )

  return Object.values(groupedData).sort((a, b) => b.count - a.count)
}
