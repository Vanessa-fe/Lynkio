import 'server-only'
import { broaderQuery, rankCandidates, toRegistryRecord, type ApiCompany, type RegistryRecord } from './registry-parse'

/**
 * Fiche officielle d'une entreprise (API Recherche d'entreprises, gratuite, sans clé).
 * Même source et mêmes règles que Sophie (supabase/functions/prospection-run).
 */

export type { RegistryRecord } from './registry-parse'

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'
const TIMEOUT_MS = 8000

async function searchApi(params: Record<string, string>): Promise<ApiCompany[] | null> {
  try {
    const response = await fetch(`${API_URL}?${new URLSearchParams(params)}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!response.ok) return null
    const body = (await response.json()) as { results?: ApiCompany[] }
    return body.results ?? []
  } catch {
    return null
  }
}

/**
 * Fiche d'une entreprise par son SIREN, ou null si elle n'est pas référencée
 * (ou si l'API ne répond pas : l'enrichissement est un bonus, pas un blocage)
 */
export async function fetchRegistryRecord(siren: string): Promise<RegistryRecord | null> {
  const results = await searchApi({ q: siren, per_page: '1' })
  const company = results?.find((result) => result.siren === siren)
  return company ? toRegistryRecord(company) : null
}

const PAGE_SIZE = 25
const MAX_PAGES = 3
// En dessous, la saisie complète est jugée trop étroite : on cherche aussi son premier mot
const NARROW_RESULTS = 10
const MAX_CANDIDATES = 25

/**
 * Jusqu'à 75 fiches pour un nom (3 pages) : le registre classe mal les noms courts,
 * la bonne entreprise peut être en 2e page. null si le registre ne répond pas.
 */
async function searchPages(query: string): Promise<RegistryRecord[] | null> {
  const records: RegistryRecord[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const results = await searchApi({ q: query, per_page: String(PAGE_SIZE), page: String(page) })
    if (!results) return page === 1 ? null : records
    records.push(...results.map(toRegistryRecord))
    if (results.length < PAGE_SIZE) break
  }
  return records
}

/**
 * Entreprises dont le nom ressemble à la saisie (homonymes compris), les plus
 * utilisables d'abord. Une saisie de plusieurs mots qui trouve peu de résultats est
 * élargie à son premier mot (« GFT technologies » → aussi « GFT »).
 * null si le registre ne répond pas.
 */
export async function searchRegistryByName(name: string): Promise<RegistryRecord[] | null> {
  const records = await searchPages(name)
  if (!records) return null

  const batches = [{ query: name, records }]
  const broader = broaderQuery(name)
  if (broader && records.length < NARROW_RESULTS) {
    const extra = await searchPages(broader)
    if (extra) batches.push({ query: broader, records: extra })
  }

  return rankCandidates(batches).slice(0, MAX_CANDIDATES)
}
