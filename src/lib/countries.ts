import { getCountries } from 'libphonenumber-js'

/**
 * Pays des entreprises (companies.country : code ISO à 2 lettres, FR par défaut) :
 * lecture d'un pays écrit librement dans un fichier, et identifiant officiel selon le pays
 * (SIREN en France, numéro d'entreprise BCE en Belgique…).
 * Aucun import interne : ce fichier est vérifié par src/lib/__checks__/countries.check.ts.
 */

export const DEFAULT_COUNTRY = 'FR'

// Entreprises immatriculées au répertoire SIRENE : la France et l'outre-mer qui a son propre code ISO
const SIREN_COUNTRIES = new Set(['FR', 'GP', 'MQ', 'GF', 'RE', 'YT', 'PM', 'BL', 'MF'])

// Noms courants absents des noms officiels (déjà normalisés : sans accents, minuscules, ponctuation retirée).
// Les principaux pays francophones sont aussi écrits ici, au cas où le navigateur ne connaîtrait pas les noms des pays.
const ALIASES: Record<string, string> = {
  france: 'FR',
  belgique: 'BE',
  belgium: 'BE',
  belgie: 'BE',
  suisse: 'CH',
  switzerland: 'CH',
  schweiz: 'CH',
  luxembourg: 'LU',
  canada: 'CA',
  quebec: 'CA',
  monaco: 'MC',
  uk: 'GB',
  angleterre: 'GB',
  england: 'GB',
  'grande bretagne': 'GB',
  'great britain': 'GB',
  usa: 'US',
  'etats unis d amerique': 'US',
  'united states of america': 'US',
  hollande: 'NL',
  holland: 'NL',
  nederland: 'NL',
  deutschland: 'DE',
  espana: 'ES',
  italia: 'IT',
  'republique tcheque': 'CZ',
  'czech republic': 'CZ',
  'ivory coast': 'CI',
  rdc: 'CD',
  'republique democratique du congo': 'CD',
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function regionNames(locale: string): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' })
  } catch {
    return null
  }
}

// Construits au premier besoin : la liste des pays vient de libphonenumber-js (celle qui lit les téléphones)
let knownCodes: Set<string> | null = null
let codeByName: Map<string, string> | null = null
let frenchNames: Intl.DisplayNames | null | undefined

function codes(): Set<string> {
  knownCodes ??= new Set(getCountries())
  return knownCodes
}

function names(): Map<string, string> {
  if (codeByName) return codeByName
  const map = new Map<string, string>()
  for (const locale of ['fr', 'en']) {
    const displayNames = regionNames(locale)
    if (!displayNames) continue
    for (const code of codes()) {
      const name = displayNames.of(code)
      if (name && name !== code) map.set(normalize(name), code)
    }
  }
  for (const [alias, code] of Object.entries(ALIASES)) map.set(alias, code)
  codeByName = map
  return map
}

/**
 * Pays écrit librement → code ISO à 2 lettres : nom en français ou en anglais, avec ou sans accents,
 * ou code (« Belgique », « Belgium », « BE », « be » → BE). Vide : France. Inconnu : null.
 */
export function parseCountry(value: string | null | undefined): string | null {
  const normalized = normalize(value ?? '')
  if (!normalized) return DEFAULT_COUNTRY
  const upper = normalized.toUpperCase()
  if (/^[A-Z]{2}$/.test(upper) && codes().has(upper)) return upper
  return names().get(normalized) ?? null
}

/**
 * Cellule « Pays » d'un fichier importé : le code du pays, ou le message qui explique pourquoi la ligne
 * est refusée (une entreprise classée en France par erreur aurait son téléphone lu comme français)
 */
export function readCountryCell(value: string | null | undefined): { value: string } | { error: string } {
  const country = parseCountry(value)
  if (country) return { value: country }
  return { error: `Pays non reconnu : « ${value?.trim()} » (écrivez son nom, par exemple Belgique, ou son code, BE)` }
}

/** Nom du pays en français (« BE » → « Belgique »), pour l'export ; le code s'il est inconnu */
export function countryLabel(code: string | null | undefined): string {
  const upper = (code?.trim() || DEFAULT_COUNTRY).toUpperCase()
  if (frenchNames === undefined) frenchNames = regionNames('fr')
  try {
    return frenchNames?.of(upper) ?? upper
  } catch {
    return upper
  }
}

/** Les entreprises de ce pays ont un SIREN (registre français : annuaire, mentions légales…) */
export function usesSiren(country: string | null | undefined): boolean {
  return SIREN_COUNTRIES.has((country?.trim() || DEFAULT_COUNTRY).toUpperCase())
}

export type RegistrationIdResult = { value: string | null } | { error: string }

/**
 * Identifiant officiel d'une entreprise selon son pays. La base n'accepte qu'une fiche par
 * identifiant et par pays (index uq_companies_registration : user_id, country, registration_id).
 * - France et outre-mer : SIREN, 9 chiffres ; un SIRET (14 chiffres) donne son SIREN.
 * - Belgique : numéro d'entreprise BCE, 10 chiffres (« 0123.456.749 », « BE 0123 456 749 »), dont les deux
 *   derniers sont une clé de contrôle (modulo 97) : une faute de frappe est repérée. À 9 chiffres, le 0 initial
 *   est rétabli (Excel le retire d'un nombre ; c'est aussi l'ancien numéro de TVA), si la clé est bonne.
 * - Autres pays : gardé, sans espaces ni ponctuation et en majuscules (« CHE-123.456.789 »
 *   → « CHE123456789 »). Il reste ainsi visible sur la fiche et reconnaît la même entreprise au
 *   prochain import ; aucune règle de format, faute de la connaître pour chaque pays.
 */
export function normalizeRegistrationId(
  raw: string | null | undefined,
  country: string | null | undefined
): RegistrationIdResult {
  const value = raw?.trim() ?? ''
  if (!value) return { value: null }

  if (usesSiren(country)) {
    const digits = value.replace(/[\s.]/g, '')
    if (/^\d{14}$/.test(digits)) return { value: digits.slice(0, 9) }
    return /^\d{9}$/.test(digits) ? { value: digits } : { error: 'Le SIREN doit contenir 9 chiffres' }
  }

  if ((country?.trim() || '').toUpperCase() === 'BE') {
    const digits = value.replace(/^BE/i, '').replace(/[\s.\-]/g, '')
    const number = /^\d{9}$/.test(digits) ? `0${digits}` : digits
    return isValidBce(number) ? { value: number } : { error: 'Numéro d’entreprise (BCE) invalide : vérifiez ses 10 chiffres' }
  }

  const compact = value.replace(/[^\p{L}\p{N}]/gu, '').toUpperCase().slice(0, 30)
  return { value: compact || null }
}

/** Numéro BCE : 10 chiffres, les deux derniers valent 97 moins le reste des huit premiers divisés par 97 */
function isValidBce(number: string): boolean {
  if (!/^\d{10}$/.test(number)) return false
  return 97 - (Number(number.slice(0, 8)) % 97) === Number(number.slice(8))
}

/** Intitulé de l'identifiant officiel selon le pays */
export function registrationLabel(country: string | null | undefined): string {
  if (usesSiren(country)) return 'SIREN'
  if (country?.toUpperCase() === 'BE') return 'N° d’entreprise (BCE)'
  return 'Identifiant officiel'
}

/** « 123 456 789 » (SIREN), « 0123.456.789 » (BCE), tel quel ailleurs */
export function formatRegistrationId(id: string, country: string | null | undefined): string {
  if (usesSiren(country)) return id.replace(/(\d{3})(?=\d)/g, '$1 ')
  if (country?.toUpperCase() === 'BE' && /^\d{10}$/.test(id)) return id.replace(/^(\d{4})(\d{3})(\d{3})$/, '$1.$2.$3')
  return id
}

/** Fiche publique de l'entreprise dans le registre de son pays, quand on le connaît */
export function registrationUrl(id: string, country: string | null | undefined): string | null {
  if (usesSiren(country)) return `https://annuaire-entreprises.data.gouv.fr/entreprise/${encodeURIComponent(id)}`
  if (country?.toUpperCase() === 'BE') {
    return `https://kbopub.economie.fgov.be/kbopub/toonondernemingps.html?lang=fr&ondernemingsnummer=${encodeURIComponent(id)}`
  }
  return null
}
