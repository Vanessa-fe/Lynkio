import { parisMidnight, type PlanKey } from '@/lib/billing'

/**
 * Prospection par WhatsApp (offre Pro) : Sophie rédige, l'utilisatrice ouvre WhatsApp avec le message
 * déjà écrit (lien wa.me) et l'envoie elle-même, puis confirme « C'est envoyé » dans Filonea.
 * Rien n'est envoyé automatiquement, et ouvrir WhatsApp ne compte pas comme un envoi.
 */

/** Plafond par défaut, modifiable dans Paramètres > Messages de Sophie (même valeur en base : 00088) */
export const WHATSAPP_DEFAULT_DAILY_LIMIT = 15
export const WHATSAPP_MIN_DAILY_LIMIT = 1
export const WHATSAPP_MAX_DAILY_LIMIT = 50
/** Au-delà, mieux vaut rester prudent avec un numéro récent */
export const WHATSAPP_SAFE_DAILY_LIMIT = 20

/** Longueur visée par Sophie ; au-delà, un avertissement s'affiche */
export const WHATSAPP_TARGET_LENGTH = 600
/** Texte enregistré au plus (le message reste modifiable avant l'ouverture de WhatsApp) */
export const WHATSAPP_MAX_LENGTH = 2000

/**
 * Début de la journée qui compte pour le plafond : minuit, heure de Paris.
 * Le compteur repart donc à zéro à minuit à Paris, quel que soit le fuseau du serveur.
 */
export function whatsappDayStart(now: Date = new Date()): Date {
  return parisMidnight(now)
}

export const WHATSAPP_CAP_MESSAGE =
  'Plafond du jour atteint. Envoyer moins de messages, mais plus personnels, protège votre numéro. Vous pouvez changer ce plafond dans les réglages.'

export function whatsappCounterLabel(used: number, limit: number): string {
  return `${used}/${limit} message${limit > 1 ? 's' : ''} aujourd’hui`
}

export type WhatsappUsage = {
  /** Offre appliquée (Pro pendant l'essai) ; WhatsApp est réservé à Pro */
  plan: PlanKey | null
  /** Messages WhatsApp marqués envoyés depuis minuit (heure de Paris) */
  used: number
  /** Plafond du jour choisi dans les réglages */
  limit: number
}
