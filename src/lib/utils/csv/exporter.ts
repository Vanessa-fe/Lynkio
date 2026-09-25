import Papa from 'papaparse'
import type { Contact, Appointment, Payment } from '@/types'
import { format } from 'date-fns'

export function exportContactsToCSV(contacts: Contact[]): string {
  const data = contacts.map((contact) => ({
    first_name: contact.first_name || '',
    last_name: contact.last_name || '',
    nickname: contact.nickname || '',
    phone: contact.phone || '',
    email: contact.email || '',
    age: contact.age?.toString() || '',
    city: contact.city || '',
    favorite: contact.favorite ? 'Oui' : 'Non',
    risk_level: contact.risk_level,
    notes: contact.notes || '',
    created_at: contact.created_at ? format(new Date(contact.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    last_interaction_at: contact.last_interaction_at
      ? format(new Date(contact.last_interaction_at), 'yyyy-MM-dd HH:mm:ss')
      : '',
  }))

  return Papa.unparse(data, {
    header: true,
  })
}

export function exportAppointmentsToCSV(appointments: Appointment[]): string {
  const data = appointments.map((appointment) => ({
    title: appointment.title,
    start_at: format(new Date(appointment.start_at), 'yyyy-MM-dd HH:mm:ss'),
    end_at: appointment.end_at
      ? format(new Date(appointment.end_at), 'yyyy-MM-dd HH:mm:ss')
      : '',
    location: appointment.location || '',
    status: appointment.status,
    notes: appointment.notes || '',
    reminder_at: appointment.reminder_at
      ? format(new Date(appointment.reminder_at), 'yyyy-MM-dd HH:mm:ss')
      : '',
    created_at: appointment.created_at ? format(new Date(appointment.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
  }))

  return Papa.unparse(data, {
    header: true,
  })
}

export function exportPaymentsToCSV(payments: Payment[]): string {
  const data = payments.map((payment) => {
    const amount = typeof payment.amount === 'string'
      ? parseFloat(payment.amount)
      : payment.amount
    const depositAmount = typeof payment.deposit_amount === 'string'
      ? parseFloat(payment.deposit_amount)
      : (payment.deposit_amount ?? 0)

    return {
      amount: amount.toFixed(2),
      deposit_amount: depositAmount.toFixed(2),
      remaining: (amount - depositAmount).toFixed(2),
      payment_method: payment.payment_method || '',
      payment_status: payment.payment_status,
      paid_at: payment.paid_at
        ? format(new Date(payment.paid_at), 'yyyy-MM-dd HH:mm:ss')
        : '',
      notes: payment.notes || '',
      created_at: payment.created_at ? format(new Date(payment.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
    }
  })

  return Papa.unparse(data, {
    header: true,
  })
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}
