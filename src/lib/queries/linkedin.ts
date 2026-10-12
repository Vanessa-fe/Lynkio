import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { LinkedinSequenceStatus } from '@/types'

// Plafonds validés avec l'utilisatrice : bien en dessous des limites de LinkedIn
export const LINKEDIN_CAPS = { invitationsPerMonth: 200, actionsPerDay: 12 }

// Relance 1 : 5 jours après le message ; message de sortie : 7 jours après la relance 1
export const FOLLOW_UP_DELAYS_DAYS = { first: 5, second: 7 }

const TIMEZONE = 'Europe/Paris'
const MAX_SEQUENCES = 2000
const DAY_MS = 24 * 60 * 60 * 1000

export type LinkedinSequenceRow = {
  id: string
  status: LinkedinSequenceStatus
  message: string | null
  messageAngle: string | null
  invitedAt: string | null
  connectedAt: string | null
  messagedAt: string | null
  followUp1: string | null
  followUp2: string | null
  followUp1At: string | null
  followUp2At: string | null
  // Date à partir de laquelle la prochaine relance peut partir (null : pas de relance à venir)
  nextFollowUpDueAt: string | null
  repliedAt: string | null
  stoppedAt: string | null
  createdAt: string
  // Ce qui a empêché l'extension d'avancer pour cette personne (elle passe alors en un clic)
  automationError: string | null
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

export type LinkedinAutomation = {
  enabled: boolean
  pausedReason: string | null
  pausedUntil: string | null
  // Dernier passage de l'extension (Chrome ouvert et connecté) et dernière action envoyée
  lastSeenAt: string | null
  lastActionAt: string | null
}

export type LinkedinCounters = {
  invitationsThisMonth: number
  actionsToday: number
}

// Jour (AAAA-MM-JJ) à l'heure de Paris
const parisDay = new Intl.DateTimeFormat('fr-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString()
}

/** Prochaine relance à envoyer, et à partir de quand */
function nextFollowUpDueAt(row: {
  status: LinkedinSequenceStatus
  messaged_at: string | null
  follow_up_1: string | null
  follow_up_1_at: string | null
  follow_up_2: string | null
}): string | null {
  if (row.status === 'messaged' && row.messaged_at && row.follow_up_1?.trim()) {
    return addDays(row.messaged_at, FOLLOW_UP_DELAYS_DAYS.first)
  }
  if (row.status === 'followed_up_1' && row.follow_up_1_at && row.follow_up_2?.trim()) {
    return addDays(row.follow_up_1_at, FOLLOW_UP_DELAYS_DAYS.second)
  }
  return null
}

/**
 * Envois LinkedIn de l'utilisatrice, et ce qui compte pour les plafonds :
 * invitations du mois, invitations, messages et relances du jour.
 */
export async function getLinkedinQueue(): Promise<{
  sequences: LinkedinSequenceRow[]
  counters: LinkedinCounters
  automation: LinkedinAutomation
  // Heure de la lecture, pour juger côté page si l'extension est passée récemment
  readAt: number
}> {
  const readAt = Date.now()
  const automation: LinkedinAutomation = {
    enabled: false,
    pausedReason: null,
    pausedUntil: null,
    lastSeenAt: null,
    lastActionAt: null,
  }
  const empty = { sequences: [], counters: { invitationsThisMonth: 0, actionsToday: 0 }, automation, readAt }
  const user = await getAuthUser()
  if (!user) return empty

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('linkedin_automation')
    .select('enabled, paused_reason, paused_until, last_seen_at, last_action_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (settings) {
    automation.enabled = settings.enabled
    automation.pausedReason = settings.paused_reason
    automation.pausedUntil = settings.paused_until
    automation.lastSeenAt = settings.last_seen_at
    automation.lastActionAt = settings.last_action_at
  }

  const { data, error } = await supabase
    .from('linkedin_sequences')
    .select(
      `id, status, message, message_angle, invited_at, connected_at, messaged_at, replied_at, stopped_at, created_at,
       follow_up_1, follow_up_2, follow_up_1_at, follow_up_2_at, automation_error,
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
    for (const sentAt of [row.messaged_at, row.follow_up_1_at, row.follow_up_2_at]) {
      if (dayOf(sentAt) === today) counters.actionsToday++
    }

    return {
      id: row.id,
      status: row.status,
      message: row.message,
      messageAngle: row.message_angle,
      invitedAt: row.invited_at,
      connectedAt: row.connected_at,
      messagedAt: row.messaged_at,
      followUp1: row.follow_up_1,
      followUp2: row.follow_up_2,
      followUp1At: row.follow_up_1_at,
      followUp2At: row.follow_up_2_at,
      nextFollowUpDueAt: nextFollowUpDueAt(row),
      repliedAt: row.replied_at,
      stoppedAt: row.stopped_at,
      createdAt: row.created_at,
      automationError: row.automation_error,
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

  return { sequences, counters, automation, readAt }
}
