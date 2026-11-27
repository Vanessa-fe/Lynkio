import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { DEFAULT_LINKEDIN_CAPS, parseLinkedinCaps, type LinkedinCaps } from '@/lib/linkedin-caps'
import type { LinkedinSequenceStatus } from '@/types'

// Relance 1 : 5 jours après le message ; message de sortie : 7 jours après la relance 1
export const FOLLOW_UP_DELAYS_DAYS = { first: 5, second: 7 }

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
 * Envois LinkedIn de l'utilisatrice, et ses plafonds (calculés par la base, comme pour l'extension) :
 * invitations du jour et sur 7 jours glissants, messages et relances du jour.
 */
export async function getLinkedinQueue(): Promise<{
  sequences: LinkedinSequenceRow[]
  caps: LinkedinCaps
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
  const empty = { sequences: [], caps: DEFAULT_LINKEDIN_CAPS, automation, readAt }
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

  // Après la lecture des réglages : le calcul peut noter que le taux d'acceptation a changé d'état
  const { data: rawCaps, error: capsError } = await supabase.rpc('linkedin_send_caps')
  if (capsError) console.error('LinkedIn caps error:', capsError)
  const caps = parseLinkedinCaps(rawCaps)

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
    return { ...empty, caps }
  }

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

  return { sequences, caps, automation, readAt }
}
