import 'server-only'
import { rankCandidates, toRegistryRecord, type ApiCompany, type RegistryRecord } from './registry-parse'

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

/**
 * Entreprises dont le nom ressemble à la saisie (homonymes compris), les plus
 * utilisables d'abord. null si le registre ne répond pas.
 */
export async function searchRegistryByName(name: string, limit = 6): Promise<RegistryRecord[] | null> {
  const results = await searchApi({ q: name, per_page: String(limit) })
  return results ? rankCandidates(results.map(toRegistryRecord)) : null
}
