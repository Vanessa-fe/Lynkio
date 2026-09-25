import { createClient } from '@/lib/supabase/server'
import type { PaymentStatus, PaymentWithRelations } from '@/types'

export async function getPayments(options?: {
  limit?: number
  offset?: number
  contactId?: string
  appointmentId?: string
  paymentStatus?: PaymentStatus
}): Promise<PaymentWithRelations[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  let query = supabase
    .from('payments')
    .select(
      `
      *,
      contact:contacts!inner(*),
      appointment:appointments(*)
    `
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Filtres
  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }

  if (options?.appointmentId) {
    query = query.eq('appointment_id', options.appointmentId)
  }

  if (options?.paymentStatus) {
    query = query.eq('payment_status', options.paymentStatus)
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
    console.error('Error fetching payments:', error)
    return []
  }

  return (data || []) as PaymentWithRelations[]
}

export async function getPaymentById(paymentId: string): Promise<PaymentWithRelations | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('payments')
    .select(
      `
      *,
      contact:contacts!inner(*),
      appointment:appointments(*)
    `
    )
    .eq('id', paymentId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    console.error('Error fetching payment:', error)
    return null
  }

  return data as PaymentWithRelations
}

export async function getContactPayments(contactId: string): Promise<PaymentWithRelations[]> {
  return getPayments({ contactId })
}

export async function getAppointmentPayments(appointmentId: string): Promise<PaymentWithRelations[]> {
  return getPayments({ appointmentId })
}

export async function getPaymentsCount(options?: {
  contactId?: string
  paymentStatus?: PaymentStatus
}): Promise<number> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return 0
  }

  let query = supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (options?.contactId) {
    query = query.eq('contact_id', options.contactId)
  }

  if (options?.paymentStatus) {
    query = query.eq('payment_status', options.paymentStatus)
  }

  const { count } = await query

  return count ?? 0
}

export async function getPendingPayments(): Promise<PaymentWithRelations[]> {
  return getPayments({ paymentStatus: 'pending' })
}

export async function getPartialPayments(): Promise<PaymentWithRelations[]> {
  return getPayments({ paymentStatus: 'partial' })
}

export async function getTotalRevenue(): Promise<number> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return 0
  }

  const { data, error } = await supabase
    .from('payments')
    .select('deposit_amount')
    .eq('user_id', user.id)
    .in('payment_status', ['paid', 'partial'])

  if (error) {
    console.error('Error calculating revenue:', error)
    return 0
  }

  return (data || []).reduce((sum, payment) => {
    // numeric : PostgREST le renvoie en nombre, Number() couvre aussi une éventuelle chaîne
    return sum + Number(payment.deposit_amount ?? 0)
  }, 0)
}

export async function getRevenueThisMonth(): Promise<number> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return 0
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const { data, error } = await supabase
    .from('payments')
    .select('deposit_amount')
    .eq('user_id', user.id)
    .in('payment_status', ['paid', 'partial'])
    .gte('paid_at', startOfMonth.toISOString())
    .lte('paid_at', endOfMonth.toISOString())

  if (error) {
    console.error('Error calculating monthly revenue:', error)
    return 0
  }

  return (data || []).reduce((sum, payment) => {
    // numeric : PostgREST le renvoie en nombre, Number() couvre aussi une éventuelle chaîne
    return sum + Number(payment.deposit_amount ?? 0)
  }, 0)
}
