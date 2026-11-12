/**
 * Catalogue des signaux (migration 00054) : nature, fiabilité et source, avec leurs libellés.
 * La fiche sépare ce qui est constaté, ce qui est supposé et ce que l'entreprise a demandé elle-même.
 */

export type SignalNature = 'observed' | 'hypothesis' | 'explicit_need'
export type SignalReliability = 'high' | 'medium' | 'low'

export const SIGNAL_NATURE_LABELS: Record<SignalNature, string> = {
  observed: 'Fait constaté',
  hypothesis: 'Hypothèse à vérifier',
  explicit_need: 'Besoin exprimé',
}

export const SIGNAL_NATURE_TONES: Record<SignalNature, string> = {
  observed: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
  hypothesis: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  explicit_need: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
}

export const SIGNAL_RELIABILITY_LABELS: Record<SignalReliability, string> = {
  high: 'source officielle',
  medium: 'source publique',
  low: 'déduit automatiquement',
}

export const SIGNAL_SOURCE_LABELS: Record<string, string> = {
  bodacc: 'BODACC (annonces légales)',
  site: 'site web de l’entreprise',
  registry: 'registre officiel des entreprises',
  france_travail: 'France Travail',
  linkedin: 'LinkedIn',
  ai_research: 'recherche de votre IA',
  manual: 'ajouté à la main',
  unknown: 'source inconnue',
}

export function signalNature(value: string | null | undefined): SignalNature {
  return value === 'hypothesis' || value === 'explicit_need' ? value : 'observed'
}

export function signalReliability(value: string | null | undefined): SignalReliability {
  return value === 'high' || value === 'low' ? value : 'medium'
}
