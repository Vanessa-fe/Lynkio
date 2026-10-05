import type { OutreachStatus } from '@/types'

/**
 * Statuts de prospection d'une personne, déduits de ses échanges (vue contact_outreach) :
 * on ne les choisit pas, on note un envoi ou une réponse et le statut suit
 */
export const OUTREACH_STATUSES = [
  'to_contact',
  'contacted',
  'followed_up',
  'replied',
  'do_not_contact',
] as const satisfies readonly OutreachStatus[]

export const outreachStatusLabels: Record<OutreachStatus, string> = {
  to_contact: 'À contacter',
  contacted: 'Contacté',
  followed_up: 'Relancé',
  replied: 'A répondu',
  do_not_contact: 'Ne pas contacter',
}

export const outreachStatusTones: Record<OutreachStatus, string> = {
  to_contact: 'bg-muted text-muted-foreground',
  contacted: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  followed_up: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  replied: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  do_not_contact: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
}
