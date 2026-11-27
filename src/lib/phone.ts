import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'

/**
 * Numéros de téléphone : tout ce qui écrit company_contacts.phone passe par toE164, pour que la base
 * ne contienne que des numéros au format international E.164 (+33612345678, +32470123456).
 * La contrainte company_contacts_phone_e164_check (00089) refuse tout autre format.
 */

/** Même règle que la contrainte de la base : « + », puis 7 à 15 chiffres, sans 0 en tête */
export const E164_PATTERN = /^\+[1-9][0-9]{6,14}$/

export const INVALID_PHONE_MESSAGE =
  'Ce numéro de téléphone n’est pas valide : vérifiez-le (par exemple 06 12 34 56 78, ou +32 470 12 34 56 pour un numéro étranger).'

/**
 * Numéro saisi librement → format E.164, ou null s'il n'est pas valide.
 * Le pays (companies.country, FR par défaut) sert à lire un numéro national : « 0470 12 34 56 » est belge
 * pour une entreprise belge. Un numéro déjà international (+32…, 0032…) garde son propre pays.
 */
export function toE164(raw: string | null | undefined, country: string | null | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  const region = (country?.trim().toUpperCase() || 'FR') as CountryCode
  // « 0032 470… » : préfixe international à l'ancienne, lu comme « +32 470… »
  const international = value.replace(/^00(?=[1-9])/, '+')
  try {
    const parsed = parsePhoneNumberFromString(international, region)
    if (!parsed?.isValid()) return null
    return E164_PATTERN.test(parsed.number) ? parsed.number : null
  } catch {
    return null
  }
}

/**
 * Lien qui ouvre WhatsApp (ou WhatsApp Business) sur la conversation avec ce numéro, message déjà écrit.
 * wa.me attend le numéro sans le « + » ; le message est encodé (accents, retours à la ligne).
 */
export function toWhatsAppLink(e164: string, message: string): string {
  const digits = e164.replace(/^\+/, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
