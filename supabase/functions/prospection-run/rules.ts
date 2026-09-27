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
