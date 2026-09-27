// Règles de sélection et de mise en forme, sans accès réseau ni base :
// faciles à relire et à faire évoluer.

// Sections de la nomenclature d'activités française (NAF rév. 2)
export const NAF_SECTION_LABELS: Record<string, string> = {
  A: 'Agriculture, sylviculture et pêche',
  B: 'Industries extractives',
  C: 'Industrie manufacturière',
  D: 'Énergie',
  E: 'Eau, déchets et dépollution',
  F: 'Construction',
  G: 'Commerce',
  H: 'Transports et entreposage',
  I: 'Hébergement et restauration',
  J: 'Information et communication',
  K: 'Finance et assurance',
  L: 'Immobilier',
  M: 'Activités spécialisées, scientifiques et techniques',
  N: 'Services administratifs et de soutien',
  O: 'Administration publique',
  P: 'Enseignement',
  Q: 'Santé et action sociale',
  R: 'Arts, spectacles et loisirs',
  S: 'Autres services',
  T: 'Activités des ménages',
  U: 'Organisations extraterritoriales',
}

// Tranches d'effectif INSEE → catégorie de taille utilisée par l'ICP.
// NN (non employeur) et 00 (0 salarié) restent inconnus : pour une entreprise
// qui vient d'être créée, l'effectif ne dit encore rien de sa taille réelle.
export function sizeCategoryFromHeadcount(code: string | null): 'tpe' | 'pme' | 'eti' | 'ge' | null {
  switch (code) {
    case '01':
    case '02':
    case '03':
      return 'tpe'
    case '11':
    case '12':
    case '21':
    case '22':
    case '31':
      return 'pme'
    case '32':
    case '41':
    case '42':
    case '51':
      return 'eti'
    case '52':
    case '53':
      return 'ge'
    default:
      return null
  }
}

// Personnes et entreprises ayant refusé la diffusion de leurs données :
// l'API les renvoie masquées, on ne les prospecte pas.
export function isNonDiffusible(value: string | null | undefined): boolean {
  return !!value && value.includes('NON-DIFFUSIBLE')
}

// Sociétés civiles (SCI, SCP, holdings patrimoniales…) : pas des clients pour un freelance
export function isCivilCompany(legalForm: string | null | undefined): boolean {
  return !!legalForm && /soci[ée]t[ée] civile/i.test(legalForm)
}

export function matchesExcludedKeyword(text: string, keywords: string[]): string | null {
  const haystack = text.toLowerCase()
  return keywords.find((keyword) => keyword && haystack.includes(keyword.toLowerCase())) ?? null
}

// « JEAN-PIERRE » → « Jean-Pierre », « DE LA TOUR » → « De La Tour »
export function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'(-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase())
}

// L'objet social déclaré se termine souvent par des formules juridiques
// génériques (« et plus généralement toutes opérations… ») : on ne garde que
// la première phrase, celle qui décrit le métier.
export function summarizeActivity(activity: string, max = 400): string {
  const firstSentence = activity.match(/^.{40,}?[.;](?=\s|$)/s)?.[0] ?? activity
  return truncate(firstSentence.trim(), max)
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

// Date du jour moins n jours, au format AAAA-MM-JJ
export function daysAgo(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

// Domaine d'un site, calculé comme la colonne générée companies.website_domain
export function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const domain = url
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/i, '')
    .replace(/[/:?#].*$/, '')
    .toLowerCase()
  return domain || null
}

// Formes juridiques retirées pour comparer deux noms d'entreprise
const LEGAL_FORM_WORDS = new Set(['sas', 'sasu', 'sarl', 'eurl', 'sa', 'sci', 'snc', 'scop', 'selarl', 'ei', 'eirl'])

/**
 * « Agence Dupont SAS » et « AGENCE DUPONT » deviennent « agence dupont » :
 * sans accents, ponctuation ni forme juridique
 */
export function normalizeCompanyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word && !LEGAL_FORM_WORDS.has(word))
    .join(' ')
}

// Division NAF (2 chiffres) → section (lettre), pour les offres dont on ne
// retrouve pas la fiche officielle
const NAF_DIVISION_RANGES: [number, number, string][] = [
  [1, 3, 'A'], [5, 9, 'B'], [10, 33, 'C'], [35, 35, 'D'], [36, 39, 'E'], [41, 43, 'F'],
  [45, 47, 'G'], [49, 53, 'H'], [55, 56, 'I'], [58, 63, 'J'], [64, 66, 'K'], [68, 68, 'L'],
  [69, 75, 'M'], [77, 82, 'N'], [84, 84, 'O'], [85, 85, 'P'], [86, 88, 'Q'], [90, 93, 'R'],
  [94, 96, 'S'], [97, 98, 'T'], [99, 99, 'U'],
]

export function nafSectionFromDivision(division: string | null | undefined): string | null {
  const value = Number(division)
  if (!division || !Number.isInteger(value)) return null
  return NAF_DIVISION_RANGES.find(([min, max]) => value >= min && value <= max)?.[2] ?? null
}
