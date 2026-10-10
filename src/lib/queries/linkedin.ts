import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { LinkedinSequenceStatus } from '@/types'

// Plafonds validés avec l'utilisatrice : bien en dessous des limites de LinkedIn
export const LINKEDIN_CAPS = { invitationsPerMonth: 200, actionsPerDay: 12 }

const TIMEZONE = 'Europe/Paris'
const MAX_SEQUENCES = 2000

export type LinkedinSequenceRow = {
  id: string
  status: LinkedinSequenceStatus
  message: string | null
  messageAngle: string | null
  invitedAt: string | null
  connectedAt: string | null
  messagedAt: string | null
  repliedAt: string | null
  stoppedAt: string | null
  createdAt: string
  listName: string | null
  contact: {
    id: string
    firstName: string | null
    lastName: string | null
    role: string | null
    linkedinUrl: string | null
    optedOut: boolean
  }
  company: { id: string; name: string; isIndividual: boolean }
}

export type LinkedinCounters = {
  invitationsThisMonth: number
  actionsToday: number
}

// Jour (AAAA-MM-JJ) à l'heure de Paris
const parisDay = new Intl.DateTimeFormat('fr-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

/**
 * Envois LinkedIn de l'utilisatrice, et ce qui compte pour les plafonds :
 * invitations du mois, invitations et messages du jour.
 */
export async function getLinkedinQueue(): Promise<{ sequences: LinkedinSequenceRow[]; counters: LinkedinCounters }> {
  const empty = { sequences: [], counters: { invitationsThisMonth: 0, actionsToday: 0 } }
  const user = await getAuthUser()
  if (!user) return empty

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('linkedin_sequences')
    .select(
      `id, status, message, message_angle, invited_at, connected_at, messaged_at, replied_at, stopped_at, created_at,
       list:prospect_lists(name),
       contact:company_contacts!inner(id, first_name, last_name, role, linkedin_url, opted_out_at,
         company:companies!inner(id, name, kind))`
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(MAX_SEQUENCES)

  if (error || !data) {
    if (error) console.error('LinkedIn queue error:', error)
    return empty
  }

  const today = parisDay.format(new Date())
  const month = today.slice(0, 7)
  const dayOf = (iso: string | null) => (iso ? parisDay.format(new Date(iso)) : null)

  const counters: LinkedinCounters = { invitationsThisMonth: 0, actionsToday: 0 }
  const sequences = data.map((row) => {
    const contact = row.contact as unknown as {
      id: string
      first_name: string | null
      last_name: string | null
      role: string | null
      linkedin_url: string | null
      opted_out_at: string | null
      company: { id: string; name: string; kind: string }
    }
    const invitedDay = dayOf(row.invited_at)
    if (invitedDay?.startsWith(month)) counters.invitationsThisMonth++
    if (invitedDay === today) counters.actionsToday++
    if (dayOf(row.messaged_at) === today) counters.actionsToday++

    return {
      id: row.id,
      status: row.status,
      message: row.message,
      messageAngle: row.message_angle,
      invitedAt: row.invited_at,
      connectedAt: row.connected_at,
      messagedAt: row.messaged_at,
      repliedAt: row.replied_at,
      stoppedAt: row.stopped_at,
      createdAt: row.created_at,
      listName: (row.list as { name: string } | null)?.name ?? null,
      contact: {
        id: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        role: contact.role,
        linkedinUrl: contact.linkedin_url,
        optedOut: contact.opted_out_at !== null,
      },
      company: { id: contact.company.id, name: contact.company.name, isIndividual: contact.company.kind === 'individual' },
    }
  })

  return { sequences, counters }
}
