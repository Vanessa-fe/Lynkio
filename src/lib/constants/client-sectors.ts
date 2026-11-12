/**
 * Secteurs proposés dans « Nouvelle recherche » (recherche par profil d'entreprise).
 * Chaque secteur regroupe quelques codes NAF (nomenclature d'activités française, rév. 2) que Sophie
 * envoie tels quels au registre officiel (API Recherche d'entreprises).
 * Les suggestions par métier ne sont que des points de départ : on peut tout cocher.
 */

export type SectorGroup = {
  key: string
  label: string
  nafCodes: string[]
}

export const SECTOR_GROUPS: SectorGroup[] = [
  { key: 'communication', label: 'Agences de communication et de publicité', nafCodes: ['73.11Z', '73.12Z', '70.21Z'] },
  { key: 'web_agencies', label: 'Agences web et studios de développement', nafCodes: ['62.01Z', '63.12Z'] },
  { key: 'software', label: 'Éditeurs de logiciels et SaaS', nafCodes: ['58.29A', '58.29B', '58.29C', '58.21Z'] },
  { key: 'it_services', label: 'ESN et conseil informatique', nafCodes: ['62.02A', '62.03Z', '62.09Z'] },
  { key: 'design', label: 'Studios de design et de graphisme', nafCodes: ['74.10Z'] },
  { key: 'photo_video', label: 'Photo, vidéo et production audiovisuelle', nafCodes: ['74.20Z', '59.11A', '59.11B', '59.11C'] },
  { key: 'events', label: 'Événementiel', nafCodes: ['82.30Z', '93.29Z'] },
  { key: 'publishing', label: 'Édition et traduction', nafCodes: ['58.11Z', '58.14Z', '74.30Z'] },
  { key: 'ecommerce', label: 'E-commerce et vente à distance', nafCodes: ['47.91A', '47.91B'] },
  { key: 'retail', label: 'Commerces et boutiques', nafCodes: ['47.71Z', '47.72A', '47.59B', '47.78C', '47.19B'] },
  { key: 'restaurants_hotels', label: 'Restaurants et hôtels', nafCodes: ['56.10A', '56.10C', '56.30Z', '55.10Z'] },
  { key: 'tourism', label: 'Tourisme et loisirs', nafCodes: ['79.11Z', '79.12Z', '55.20Z', '93.21Z'] },
  { key: 'wellness', label: 'Beauté, bien-être et sport', nafCodes: ['96.02A', '96.02B', '96.04Z', '93.13Z'] },
  { key: 'real_estate', label: 'Immobilier', nafCodes: ['68.31Z', '68.20B', '68.32A'] },
  { key: 'construction', label: 'Artisans et entreprises du bâtiment', nafCodes: ['43.21A', '43.22A', '43.22B', '43.31Z', '43.32A', '43.34Z', '43.39Z', '41.20A'] },
  { key: 'architecture', label: 'Architectes et bureaux d’études', nafCodes: ['71.11Z', '71.12B'] },
  { key: 'industry', label: 'PME industrielles', nafCodes: ['25.62B', '25.11Z', '28.29B', '33.12Z', '22.29A'] },
  { key: 'health', label: 'Santé (cabinets, cliniques, paramédical)', nafCodes: ['86.21Z', '86.22C', '86.23Z', '86.90E', '86.10Z'] },
  { key: 'legal_accounting', label: 'Experts-comptables et avocats', nafCodes: ['69.20Z', '69.10Z'] },
  { key: 'consulting', label: 'Conseil aux entreprises', nafCodes: ['70.22Z', '73.20Z'] },
  { key: 'training', label: 'Organismes de formation', nafCodes: ['85.59A', '85.59B', '85.60Z'] },
  { key: 'transport', label: 'Transport et logistique', nafCodes: ['49.41A', '52.29A'] },
  { key: 'associations', label: 'Associations', nafCodes: ['94.99Z'] },
]

const GROUPS_BY_KEY = new Map(SECTOR_GROUPS.map((group) => [group.key, group]))

/** Clients directs et partenaires (qui sous-traitent) suggérés pour chaque métier */
export const SECTOR_SUGGESTIONS: Record<string, { profile: string[]; partner: string[] }> = {
  web_developer: {
    profile: ['ecommerce', 'retail', 'real_estate', 'health', 'legal_accounting', 'consulting', 'training', 'industry'],
    partner: ['web_agencies', 'communication', 'design', 'software'],
  },
  designer: {
    profile: ['retail', 'restaurants_hotels', 'wellness', 'real_estate', 'construction', 'associations', 'events'],
    partner: ['communication', 'web_agencies', 'events'],
  },
  copywriter_seo: {
    profile: ['ecommerce', 'retail', 'consulting', 'legal_accounting', 'health', 'tourism'],
    partner: ['communication', 'web_agencies', 'publishing'],
  },
  marketing_communication: {
    profile: ['retail', 'restaurants_hotels', 'real_estate', 'wellness', 'tourism', 'construction', 'training'],
    partner: ['communication', 'web_agencies', 'events'],
  },
  video_photo: {
    profile: ['real_estate', 'restaurants_hotels', 'tourism', 'events', 'construction', 'industry'],
    partner: ['communication', 'photo_video', 'events'],
  },
  admin_assistant: {
    profile: ['construction', 'health', 'legal_accounting', 'consulting', 'real_estate', 'associations'],
    partner: ['legal_accounting', 'consulting'],
  },
}

export function sectorSuggestions(professionKey: string | null, approach: 'profile' | 'partner'): string[] {
  return (professionKey && SECTOR_SUGGESTIONS[professionKey]?.[approach]) || []
}

export function sectorGroup(key: string): SectorGroup | undefined {
  return GROUPS_BY_KEY.get(key)
}

/** Codes NAF des secteurs choisis, sans doublon */
export function nafCodesForGroups(keys: string[]): string[] {
  return [...new Set(keys.flatMap((key) => GROUPS_BY_KEY.get(key)?.nafCodes ?? []))]
}

/** Secteur (libellé) auquel appartient un code NAF, pour « Pourquoi cette entreprise » */
export function sectorLabelForNaf(nafCode: string | null | undefined, onlyKeys?: string[]): string | null {
  if (!nafCode) return null
  const group = SECTOR_GROUPS.find(
    (candidate) => (!onlyKeys || onlyKeys.includes(candidate.key)) && candidate.nafCodes.includes(nafCode)
  )
  return group?.label ?? null
}

export const STRATEGY_SIZES = [
  { value: 'tpe', label: 'TPE (1 à 9 salariés)' },
  { value: 'pme', label: 'PME (10 à 249 salariés)' },
  { value: 'eti', label: 'ETI (250 à 4 999 salariés)' },
] as const

export type StrategySize = (typeof STRATEGY_SIZES)[number]['value']

// Ancienneté de l'entreprise (facultative : rien de coché = toutes). Mêmes bornes que le détecteur
// (supabase/functions/prospection-run/detect-profile.ts, AGE_RANGES).
export const STRATEGY_AGES = [
  { value: 'new', label: 'Créée il y a moins de 2 ans', hint: 'tout est encore à mettre en place' },
  { value: 'established', label: 'Créée il y a 2 à 10 ans', hint: 'en développement' },
  { value: 'old', label: 'Créée il y a plus de 10 ans', hint: 'bien installée' },
] as const

export type StrategyAge = (typeof STRATEGY_AGES)[number]['value']

/** Tranche d'ancienneté d'une date de création (null si inconnue) */
export function companyAgeRange(foundedOn: string | null, now = new Date()): StrategyAge | null {
  if (!foundedOn) return null
  const founded = new Date(foundedOn)
  if (Number.isNaN(founded.getTime())) return null
  const years = (now.getTime() - founded.getTime()) / (365.25 * 24 * 3600 * 1000)
  if (years < 2) return 'new'
  if (years < 10) return 'established'
  return 'old'
}

export const APPROACH_LABELS: Record<'profile' | 'partner', string> = {
  profile: 'Clients directs',
  partner: 'Partenaires qui sous-traitent',
}
