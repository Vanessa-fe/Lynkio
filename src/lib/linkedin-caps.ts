/**
 * Plafonds des envois LinkedIn (envoi automatique et envois notés en un clic), comptés comme LinkedIn
 * les compte : invitations par jour et sur 7 jours glissants, messages par jour (premier message et
 * relances), à l'heure de Paris. Le calcul est fait par la base (linkedin_send_caps, migration 00090),
 * pour Filonea comme pour l'extension ; ce fichier en lit le résultat et porte les textes.
 */

export const LINKEDIN_INVITATIONS_PER_DAY = { default: 15, min: 1, max: 25 }
// Limite dure : LinkedIn bloque autour de 100 invitations par semaine, quel que soit l'abonnement
export const LINKEDIN_INVITATIONS_PER_WEEK = 100
export const LINKEDIN_MESSAGES_PER_DAY = { default: 20, min: 1, max: 40 }

export const LINKEDIN_PACE_HELP =
  'LinkedIn limite les invitations à environ 100 par semaine. Au-delà, il bloque l’envoi, et un compte qui insiste peut être restreint. 15 par jour est un bon rythme.'

export type LinkedinCaps = {
  invitationsToday: number
  invitationsWeek: number
  messagesToday: number
  // Plafonds en vigueur maintenant (démarrage et taux d'acceptation compris)
  invitationsTodayCap: number
  invitationsWeekCap: number
  messagesTodayCap: number
  // Réglages de l'utilisatrice
  dailyInvitationsLimit: number
  dailyMessagesLimit: number
  // Quand une place se libère dans la fenêtre de 7 jours
  weekFreesAt: string | null
  // Démarrage en douceur en cours : plafonds du jour divisés par 2 jusqu'à cette date
  rampUpUntil: string | null
  // Taux d'acceptation (en %) des 50 dernières invitations de plus de 7 jours ; null : pas assez d'invitations
  acceptanceRate: number | null
  acceptanceJudged: number
  // Taux bas : le plafond d'invitations est divisé par 2
  lowAcceptance: boolean
  // LinkedIn a répondu « limite hebdomadaire atteinte » : plus d'invitation avant cette date
  invitationsHeldUntil: string | null
  canInvite: boolean
  canMessage: boolean
}

export const DEFAULT_LINKEDIN_CAPS: LinkedinCaps = {
  invitationsToday: 0,
  invitationsWeek: 0,
  messagesToday: 0,
  invitationsTodayCap: LINKEDIN_INVITATIONS_PER_DAY.default,
  invitationsWeekCap: LINKEDIN_INVITATIONS_PER_WEEK,
  messagesTodayCap: LINKEDIN_MESSAGES_PER_DAY.default,
  dailyInvitationsLimit: LINKEDIN_INVITATIONS_PER_DAY.default,
  dailyMessagesLimit: LINKEDIN_MESSAGES_PER_DAY.default,
  weekFreesAt: null,
  rampUpUntil: null,
  acceptanceRate: null,
  acceptanceJudged: 0,
  lowAcceptance: false,
  invitationsHeldUntil: null,
  canInvite: true,
  canMessage: true,
}

const number = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const text = (value: unknown) => (typeof value === 'string' && value ? value : null)

/** Réponse de linkedin_send_caps() → plafonds lisibles (valeurs par défaut si un champ manque) */
export function parseLinkedinCaps(raw: unknown): LinkedinCaps {
  if (!raw || typeof raw !== 'object') return DEFAULT_LINKEDIN_CAPS
  const row = raw as Record<string, unknown>
  const caps: LinkedinCaps = {
    invitationsToday: number(row.invitations_today, 0),
    invitationsWeek: number(row.invitations_week, 0),
    messagesToday: number(row.messages_today, 0),
    invitationsTodayCap: number(row.invitations_today_cap, DEFAULT_LINKEDIN_CAPS.invitationsTodayCap),
    invitationsWeekCap: number(row.invitations_week_cap, LINKEDIN_INVITATIONS_PER_WEEK),
    messagesTodayCap: number(row.messages_today_cap, DEFAULT_LINKEDIN_CAPS.messagesTodayCap),
    dailyInvitationsLimit: number(row.daily_invitations_limit, LINKEDIN_INVITATIONS_PER_DAY.default),
    dailyMessagesLimit: number(row.daily_messages_limit, LINKEDIN_MESSAGES_PER_DAY.default),
    weekFreesAt: text(row.week_frees_at),
    rampUpUntil: text(row.ramp_up_until),
    acceptanceRate: typeof row.acceptance_rate === 'number' ? row.acceptance_rate : null,
    acceptanceJudged: number(row.acceptance_judged, 0),
    lowAcceptance: row.low_acceptance === true,
    invitationsHeldUntil: text(row.invitations_held_until),
    canInvite: true,
    canMessage: true,
  }
  caps.canInvite =
    typeof row.can_invite === 'boolean'
      ? row.can_invite
      : !caps.invitationsHeldUntil &&
        caps.invitationsToday < caps.invitationsTodayCap &&
        caps.invitationsWeek < caps.invitationsWeekCap
  caps.canMessage = typeof row.can_message === 'boolean' ? row.can_message : caps.messagesToday < caps.messagesTodayCap
  return caps
}

/** Message affiché quand peu d'invitations sont acceptées (le plafond d'invitations est alors divisé par 2) */
export function lowAcceptanceMessage(rate: number): string {
  return `Peu de vos invitations sont acceptées en ce moment (${rate} %). Pour protéger votre compte, Filonea envoie moins d’invitations. Pour améliorer ce taux : ciblez des personnes plus proches de votre activité, ajoutez une courte note personnelle, et vérifiez que votre titre de profil dit clairement ce que vous faites.`
}

/** « Invitations : 9/15 aujourd'hui · 62/100 cette semaine · Messages : 4/20 aujourd'hui · Taux d'acceptation : 34 % » */
export function linkedinCapsSummary(caps: LinkedinCaps): string {
  const parts = [
    `Invitations : ${caps.invitationsToday}/${caps.invitationsTodayCap} aujourd’hui`,
    `${caps.invitationsWeek}/${caps.invitationsWeekCap} cette semaine`,
    `Messages : ${caps.messagesToday}/${caps.messagesTodayCap} aujourd’hui`,
  ]
  if (caps.acceptanceRate !== null) parts.push(`Taux d’acceptation : ${caps.acceptanceRate} %`)
  return parts.join(' · ')
}
