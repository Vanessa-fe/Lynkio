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

/**
 * Disponibilité d'un type de signal (migration 00065) : ce que Sophie sait réellement détecter.
 * - available : un détecteur le crée aujourd'hui (réglable avec un curseur) ;
 * - unavailable : pas encore de source fiable (montré comme indisponible, sans points) ;
 * - retired : source arrêtée (offres d'emploi France Travail), jamais montré ni compté.
 */
export type SignalAvailability = 'available' | 'unavailable' | 'retired'

export function signalAvailability(value: string | null | undefined): SignalAvailability {
  return value === 'available' || value === 'retired' ? value : 'unavailable'
}

/** État d'un signal dans les réglages : actif (rapporte des points), inactif (0 point) ou indisponible */
export type SignalState = 'active' | 'inactive' | 'unavailable'

export const SIGNAL_STATE_LABELS: Record<SignalState, string> = {
  active: 'Actif',
  inactive: 'Inactif',
  unavailable: 'Indisponible',
}

export const SIGNAL_STATE_TONES: Record<SignalState, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  inactive: 'bg-muted text-muted-foreground',
  unavailable: 'bg-muted text-muted-foreground',
}

export function signalState(availability: SignalAvailability, weight: number): SignalState {
  if (availability !== 'available') return 'unavailable'
  return weight > 0 ? 'active' : 'inactive'
}

type GroupableSignal = { availability: SignalAvailability; isProfessionSignal: boolean }

/**
 * Répartition des signaux dans les réglages : ceux du métier, les autres détectables (repliés),
 * et ceux qui ne sont pas encore détectables (repliés, sans curseur). Les signaux retirés disparaissent.
 */
export function groupSignalsForSettings<T extends GroupableSignal>(
  signals: T[]
): { profession: T[]; other: T[]; unavailable: T[] } {
  const detectable = signals.filter((signal) => signal.availability === 'available')
  return {
    profession: detectable.filter((signal) => signal.isProfessionSignal),
    other: detectable.filter((signal) => !signal.isProfessionSignal),
    unavailable: signals.filter((signal) => signal.availability === 'unavailable'),
  }
}

/**
 * Points enregistrés (icp_profiles.signal_weights) : seuls les écarts aux valeurs par défaut du métier.
 * Un réglage déjà enregistré pour un signal absent du formulaire (retiré, par exemple) est conservé
 * tel quel : enregistrer les réglages n'efface jamais un choix de l'utilisateur.
 */
export function mergeSignalWeights(
  existing: unknown,
  submitted: Record<string, number>,
  defaults: Map<string, number>
): Record<string, number> {
  const kept = Object.fromEntries(
    Object.entries(existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {}).filter(
      (entry): entry is [string, number] => !(entry[0] in submitted) && typeof entry[1] === 'number'
    )
  )
  const changed = Object.fromEntries(
    Object.entries(submitted).filter(([signalType, weight]) => weight !== (defaults.get(signalType) ?? 0))
  )
  return { ...kept, ...changed }
}

export function signalNature(value: string | null | undefined): SignalNature {
  return value === 'hypothesis' || value === 'explicit_need' ? value : 'observed'
}

export function signalReliability(value: string | null | undefined): SignalReliability {
  return value === 'high' || value === 'low' ? value : 'medium'
}
