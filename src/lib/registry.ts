import 'server-only'
import type { SizeCategory } from '@/types'

/**
 * Fiche officielle d'une entreprise (API Recherche d'entreprises, gratuite, sans clé).
 * Même source et mêmes règles que Sophie (supabase/functions/prospection-run).
 */

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'
const TIMEOUT_MS = 8000

type ApiCompany = {
  siren: string
  nom_complet: string
  date_creation?: string | null
  activite_principale?: string | null
  section_activite_principale?: string | null
  tranche_effectif_salarie?: string | null
  finances?: Record<string, { ca?: number | null; resultat_net?: number | null }> | null
  dirigeants?: { nom?: string; prenoms?: string; qualite?: string; type_dirigeant?: string }[]
  siege?: { code_postal?: string | null; libelle_commune?: string | null }
}

export type RegistryRecord = {
  siren: string
  name: string
  foundedOn: string | null
  nafCode: string | null
  sector: string | null
  headcountCode: string | null
  sizeCategory: SizeCategory | null
  city: string | null
  postalCode: string | null
  finances: { revenue: number; netIncome: number | null; year: number } | null
  // Données masquées à la demande de l'entreprise ou de son dirigeant
  isNonDiffusible: boolean
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
function sizeFromHeadcount(code: string | null | undefined): SizeCategory | null {
  if (!code) return null
  if (['01', '02', '03'].includes(code)) return 'tpe'
  if (['11', '12', '21', '22', '31'].includes(code)) return 'pme'
  if (['32', '41', '42', '51'].includes(code)) return 'eti'
  if (['52', '53'].includes(code)) return 'ge'
  return null
}

// « JEAN-PIERRE » → « Jean-Pierre »
function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/(^|[\s'(-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toUpperCase())
}

const hidden = (value: string | null | undefined) => !!value && value.includes('NON-DIFFUSIBLE')

/**
 * Fiche d'une entreprise par son SIREN, ou null si elle n'est pas référencée
 * (ou si l'API ne répond pas : l'enrichissement est un bonus, pas un blocage)
 */
export async function fetchRegistryRecord(siren: string): Promise<RegistryRecord | null> {
  let company: ApiCompany | undefined
  try {
    const response = await fetch(`${API_URL}?${new URLSearchParams({ q: siren, per_page: '1' })}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { results?: ApiCompany[] }
    company = body.results?.find((result) => result.siren === siren)
  } catch {
    return null
  }
  if (!company) return null

  // Dernier exercice publié avec un chiffre d'affaires (0 ou absent : comptes confidentiels)
  const [year, values] =
    Object.entries(company.finances ?? {})
      .filter(([key, entry]) => /^\d{4}$/.test(key) && (entry?.ca ?? 0) > 0)
      .sort(([a], [b]) => Number(b) - Number(a))[0] ?? []

  const section = company.section_activite_principale

  return {
    siren: company.siren,
    name: company.nom_complet,
    foundedOn: company.date_creation ?? null,
    nafCode: company.activite_principale ?? null,
    sector: section ? (NAF_SECTION_LABELS[section] ?? null) : null,
    headcountCode: company.tranche_effectif_salarie ?? null,
    sizeCategory: sizeFromHeadcount(company.tranche_effectif_salarie),
    city: company.siege?.libelle_commune ? titleCase(company.siege.libelle_commune) : null,
    postalCode: company.siege?.code_postal ?? null,
    finances:
      year && values
        ? { revenue: Math.round(values.ca ?? 0), netIncome: values.resultat_net ?? null, year: Number(year) }
        : null,
    isNonDiffusible: hidden(company.nom_complet),
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
