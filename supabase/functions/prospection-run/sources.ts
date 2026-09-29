// Sources de données officielles et gratuites, sans clé d'API.
//
// - BODACC (bulletin officiel) : chaque immatriculation y est publiée, avec le
//   SIREN, le département et l'activité déclarée. C'est lui qui répond à
//   « quelles entreprises viennent d'être créées ? ».
// - API Recherche d'entreprises : complète avec le code NAF, la tranche
//   d'effectif et les dirigeants. Elle ne sait pas filtrer par date de création,
//   d'où l'usage combiné des deux.

const BODACC_URL =
  'https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records'
const RECHERCHE_ENTREPRISES_URL = 'https://recherche-entreprises.api.gouv.fr/search'

// L'API Recherche d'entreprises accepte au plus 7 requêtes par seconde
const RECHERCHE_ENTREPRISES_DELAY_MS = 200
const REQUEST_TIMEOUT_MS = 15_000

export const BODACC_PAGE_SIZE = 100

type BodaccAddress = {
  codePostal?: string
  ville?: string
}

export type BodaccLegalEntity = {
  typePersonne?: string
  denomination?: string
  formeJuridique?: string
  capital?: { montantCapital?: string; devise?: string }
  adresseSiegeSocial?: BodaccAddress
}

export type BodaccCreation = {
  id: string
  dateparution: string
  numerodepartement: string
  registre: string[] | null
  commercant: string | null
  ville: string | null
  cp: string | null
  url_complete: string | null
  listepersonnes: string | null
  listeetablissements: string | null
  acte: string | null
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

// Les champs JSON du BODACC contiennent un objet, ou une liste s'il y en a plusieurs
function asList<T>(value: T | T[] | undefined): T[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function bodaccLegalEntity(record: BodaccCreation): BodaccLegalEntity | null {
  const parsed = parseJson<{ personne?: BodaccLegalEntity | BodaccLegalEntity[] }>(record.listepersonnes)
  return asList(parsed?.personne).find((person) => person.typePersonne === 'pm') ?? null
}

export function bodaccActivity(record: BodaccCreation): string | null {
  const parsed = parseJson<{ etablissement?: { activite?: string } | { activite?: string }[] }>(
    record.listeetablissements
  )
  const activities = asList(parsed?.etablissement)
    .map((establishment) => establishment.activite?.trim())
    .filter((activity): activity is string => !!activity)
  return activities.length > 0 ? activities.join(' / ') : null
}

export function bodaccActivityStart(record: BodaccCreation): string | null {
  const parsed = parseJson<{ dateCommencementActivite?: string }>(record.acte)
  const date = parsed?.dateCommencementActivite
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

export function bodaccSiren(record: BodaccCreation): string | null {
  const siren = record.registre?.[0]?.replace(/\s/g, '')
  return siren && /^\d{9}$/.test(siren) ? siren : null
}

/**
 * Créations de sociétés (personnes morales) publiées depuis `since` dans les
 * départements donnés, de la plus récente à la plus ancienne.
 */
export async function fetchBodaccCreations(
  departments: string[],
  since: string,
  offset: number
): Promise<{ total: number; records: BodaccCreation[] }> {
  const departmentList = departments.map((code) => `"${code}"`).join(',')
  const where = [
    'familleavis="creation"',
    `numerodepartement in (${departmentList})`,
    `dateparution >= date'${since}'`,
    // Les entrepreneurs individuels (personnes physiques) sont écartés
    'listepersonnes like "%\\"typePersonne\\": \\"pm\\"%"',
  ].join(' and ')

  const params = new URLSearchParams({
    where,
    order_by: 'dateparution desc, id desc',
    limit: String(BODACC_PAGE_SIZE),
    offset: String(offset),
    select:
      'id,dateparution,numerodepartement,registre,commercant,ville,cp,url_complete,listepersonnes,listeetablissements,acte',
  })

  const response = await fetch(`${BODACC_URL}?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`BODACC indisponible (HTTP ${response.status})`)
  }

  const body = (await response.json()) as { total_count: number; results: BodaccCreation[] }
  return { total: body.total_count, records: body.results ?? [] }
}

export type CompanyDirector = {
  nom?: string
  prenoms?: string
  qualite?: string
  type_dirigeant?: string
}

export type RegistryCompany = {
  siren: string
  nom_complet: string
  nom_raison_sociale: string | null
  sigle: string | null
  date_creation: string | null
  activite_principale: string | null
  section_activite_principale: string | null
  tranche_effectif_salarie: string | null
  etat_administratif: string | null
  dirigeants: CompanyDirector[]
  // Comptes publiés, par année : { "2024": { ca, resultat_net } } (0 ou null si confidentiels)
  finances?: Record<string, { ca?: number | null; resultat_net?: number | null }> | null
  siege?: {
    code_postal?: string | null
    libelle_commune?: string | null
    nom_commercial?: string | null
    liste_enseignes?: string[] | null
  }
}

async function searchRegistry(params: Record<string, string>): Promise<RegistryCompany[]> {
  const url = `${RECHERCHE_ENTREPRISES_URL}?${new URLSearchParams(params)}`

  for (let attempt = 0; attempt < 2; attempt++) {
    await sleep(RECHERCHE_ENTREPRISES_DELAY_MS * (attempt + 1))

    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })

    if (response.status === 429) {
      // Limite de débit : on patiente une seconde avant l'unique nouvel essai
      await sleep(1000)
      continue
    }

    if (!response.ok) {
      throw new Error(`API Recherche d'entreprises indisponible (HTTP ${response.status})`)
    }

    const body = (await response.json()) as { results?: RegistryCompany[] }
    return body.results ?? []
  }

  return []
}

/**
 * Fiche d'une entreprise par son SIREN, ou null si elle n'est pas (encore) référencée
 */
export async function fetchRegistryCompany(siren: string): Promise<RegistryCompany | null> {
  const results = await searchRegistry({ q: siren, per_page: '1' })
  return results.find((company) => company.siren === siren) ?? null
}

/**
 * Entreprises actives dont un établissement est dans le département, pour un nom donné.
 * Le rapprochement final (même nom ?) est fait par l'appelant.
 */
export async function searchRegistryByName(name: string, department: string | null): Promise<RegistryCompany[]> {
  const params: Record<string, string> = { q: name, per_page: '5', etat_administratif: 'A' }
  if (department) params.departement = department
  return await searchRegistry(params)
}
