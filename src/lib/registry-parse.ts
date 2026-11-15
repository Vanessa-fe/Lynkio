import type { SizeCategory } from '@/types'

/**
 * Lecture des fiches de l'API Recherche d'entreprises (sans appel réseau, testable).
 * Même source et mêmes règles que Sophie (supabase/functions/prospection-run).
 */

export type ApiCompany = {
  siren: string
  nom_complet: string
  date_creation?: string | null
  activite_principale?: string | null
  section_activite_principale?: string | null
  tranche_effectif_salarie?: string | null
  // A : active ; C : cessée
  etat_administratif?: string | null
  // O : diffusible ; P : diffusion partielle (personne ayant demandé à ne pas apparaître)
  statut_diffusion?: string | null
  // L'entreprise s'oppose à l'utilisation de ses données à des fins de prospection commerciale
  opposition_diffusion_commerciale?: boolean | null
  finances?: Record<string, { ca?: number | null; resultat_net?: number | null }> | null
  dirigeants?: { nom?: string; prenoms?: string; qualite?: string; type_dirigeant?: string }[]
  siege?: { adresse?: string | null; code_postal?: string | null; libelle_commune?: string | null }
}

export type RegistryRecord = {
  siren: string
  name: string
  foundedOn: string | null
  nafCode: string | null
  sector: string | null
  headcountCode: string | null
  sizeCategory: SizeCategory | null
  address: string | null
  city: string | null
  postalCode: string | null
  finances: { revenue: number; netIncome: number | null; year: number } | null
  // Données masquées à la demande de l'entreprise ou de son dirigeant
  isNonDiffusible: boolean
  // Opposition enregistrée au registre : ne pas la prospecter
  refusesProspecting: boolean
  isClosed: boolean
  directors: { firstName: string | null; lastName: string; role: string | null }[]
}

const NAF_SECTION_LABELS: Record<string, string> = {
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

// Tranches d'effectif INSEE → catégorie de taille (NN et 00 : inconnue)
export function sizeFromHeadcount(code: string | null | undefined): SizeCategory | null {
  if (!code) return null
  if (['01', '02', '03'].includes(code)) return 'tpe'
  if (['11', '12', '21', '22', '31'].includes(code)) return 'pme'
  if (['32', '41', '42', '51'].includes(code)) return 'eti'
  if (['52', '53'].includes(code)) return 'ge'
  return null
}

const HEADCOUNT_LABELS: Record<string, string> = {
  '00': '0 salarié',
  '01': '1 ou 2 salariés',
  '02': '3 à 5 salariés',
  '03': '6 à 9 salariés',
  '11': '10 à 19 salariés',
  '12': '20 à 49 salariés',
  '21': '50 à 99 salariés',
  '22': '100 à 199 salariés',
  '31': '200 à 249 salariés',
  '32': '250 à 499 salariés',
  '41': '500 à 999 salariés',
  '42': '1 000 à 1 999 salariés',
  '51': '2 000 à 4 999 salariés',
  '52': '5 000 à 9 999 salariés',
  '53': '10 000 salariés et plus',
}

/** « 20 à 49 salariés », ou null si l'effectif n'est pas connu */
export function headcountLabel(code: string | null | undefined): string | null {
  return code ? (HEADCOUNT_LABELS[code] ?? null) : null
}

// « JEAN-PIERRE » → « Jean-Pierre »
export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'(-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase())
}

const hidden = (value: string | null | undefined) => !!value && value.includes('NON-DIFFUSIBLE')

export function toRegistryRecord(company: ApiCompany): RegistryRecord {
  // Dernier exercice publié avec un chiffre d'affaires (0 ou absent : comptes confidentiels)
  const [year, values] =
    Object.entries(company.finances ?? {})
      .filter(([key, entry]) => /^\d{4}$/.test(key) && (entry?.ca ?? 0) > 0)
      .sort(([a], [b]) => Number(b) - Number(a))[0] ?? []

  const section = company.section_activite_principale
  const isNonDiffusible =
    hidden(company.nom_complet) || (!!company.statut_diffusion && company.statut_diffusion !== 'O')

  return {
    siren: company.siren,
    name: company.nom_complet,
    foundedOn: company.date_creation ?? null,
    nafCode: company.activite_principale ?? null,
    sector: section ? (NAF_SECTION_LABELS[section] ?? null) : null,
    headcountCode: company.tranche_effectif_salarie ?? null,
    sizeCategory: sizeFromHeadcount(company.tranche_effectif_salarie),
    address: company.siege?.adresse && !hidden(company.siege.adresse) ? titleCase(company.siege.adresse) : null,
    city: company.siege?.libelle_commune ? titleCase(company.siege.libelle_commune) : null,
    postalCode: company.siege?.code_postal ?? null,
    finances:
      year && values
        ? { revenue: Math.round(values.ca ?? 0), netIncome: values.resultat_net ?? null, year: Number(year) }
        : null,
    isNonDiffusible,
    refusesProspecting: company.opposition_diffusion_commerciale === true,
    isClosed: company.etat_administratif === 'C',
    directors: (company.dirigeants ?? [])
      .filter((director) => director.type_dirigeant === 'personne physique' && director.nom && !hidden(director.nom))
      .slice(0, 3)
      .map((director) => ({
        firstName: director.prenoms ? titleCase(director.prenoms.split(/\s+/)[0] ?? '') : null,
        lastName: titleCase(director.nom ?? ''),
        role: director.qualite ?? null,
      })),
  }
}

/**
 * Peut-on pré-remplir une fiche avec cette entreprise ? Non si elle s'oppose
 * à la prospection ou si ses données sont masquées (mêmes règles que Sophie).
 */
export function blockedReason(record: Pick<RegistryRecord, 'refusesProspecting' | 'isNonDiffusible'>): string | null {
  if (record.refusesProspecting) return 'Refuse la prospection commerciale (registre officiel)'
  if (record.isNonDiffusible) return 'Données masquées à la demande de l’entreprise'
  return null
}

/**
 * Homonymes : les entreprises utilisables d'abord, les cessées et les refus à la fin
 * (l'ordre de pertinence du registre est gardé à l'intérieur de chaque groupe)
 */
export function rankCandidates(records: RegistryRecord[]): RegistryRecord[] {
  const weight = (record: RegistryRecord) => (blockedReason(record) ? 2 : record.isClosed ? 1 : 0)
  return records
    .map((record, index) => ({ record, index }))
    .sort((a, b) => weight(a.record) - weight(b.record) || a.index - b.index)
    .map(({ record }) => record)
}

export type LookupQuery =
  | { kind: 'siren'; siren: string }
  | { kind: 'website'; url: string }
  | { kind: 'name'; name: string }
  | { kind: 'empty' }

/**
 * Ce que l'utilisatrice a tapé : un SIREN (ou SIRET), un site, ou un nom
 */
export function classifyLookupQuery(raw: string): LookupQuery {
  const value = raw.trim()
  if (!value) return { kind: 'empty' }

  const digits = value.replace(/[\s.]/g, '')
  if (/^\d{9}$/.test(digits)) return { kind: 'siren', siren: digits }
  if (/^\d{14}$/.test(digits)) return { kind: 'siren', siren: digits.slice(0, 9) }

  // Site : une adresse avec protocole, « www. », ou un domaine sans espace (« atelier-dupont.fr »)
  if (/^https?:\/\//i.test(value) || /^www\./i.test(value) || /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(value)) {
    return { kind: 'website', url: /^https?:\/\//i.test(value) ? value : `https://${value}` }
  }

  return { kind: 'name', name: value.slice(0, 200) }
}

/**
 * Nom probable d'une entreprise d'après sa page d'accueil (og:site_name, puis le titre
 * sans son slogan), pour chercher au registre quand le site n'affiche pas de SIREN
 */
export function siteNameFromHtml(html: string): string | null {
  const decode = (value: string) =>
    value.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

  const ogSiteName =
    html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i)?.[1]
  if (ogSiteName && decode(ogSiteName)) return decode(ogSiteName).slice(0, 100)

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  if (!title) return null
  // « Atelier Dupont | Menuiserie à Lyon » → « Atelier Dupont »
  const name = decode(title).split(/\s[|–—-]\s|\s·\s/)[0]?.trim()
  return name ? name.slice(0, 100) : null
}
