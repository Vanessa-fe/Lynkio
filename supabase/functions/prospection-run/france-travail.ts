// API Offres d'emploi v2 de France Travail
// https://francetravail.io/data/api/offres-emploi
//
// Authentification OAuth2 « client_credentials » avec les clés de
// l'application déclarée sur francetravail.io, enregistrées dans les secrets
// Supabase (FRANCE_TRAVAIL_CLIENT_ID, FRANCE_TRAVAIL_CLIENT_SECRET).

import { UserFacingError } from './context.ts'

const TOKEN_URL = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire'
const SEARCH_URL = 'https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search'
const SCOPE = 'api_offresdemploiv2 o2dsoffre'
const REQUEST_TIMEOUT_MS = 15_000

// Au plus 150 offres par page ; l'API refuse d'aller au-delà de l'offre 3 149
export const OFFERS_PAGE_SIZE = 150
const MAX_RANGE_END = 3149
// L'API accepte au plus 5 départements par recherche
const MAX_DEPARTMENTS_PER_SEARCH = 5

export type JobOffer = {
  id: string
  intitule?: string
  dateCreation?: string
  romeCode?: string
  romeLibelle?: string
  typeContrat?: string
  typeContratLibelle?: string
  secteurActivite?: string
  secteurActiviteLibelle?: string
  lieuTravail?: { libelle?: string; codePostal?: string; commune?: string }
  entreprise?: { nom?: string; description?: string; url?: string; entrepriseAdaptee?: boolean }
  origineOffre?: { origine?: string; urlOrigine?: string }
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const clientId = Deno.env.get('FRANCE_TRAVAIL_CLIENT_ID')
  const clientSecret = Deno.env.get('FRANCE_TRAVAIL_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new UserFacingError('Les clés France Travail ne sont pas encore enregistrées sur Supabase')
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: SCOPE,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
  }

  if (!response.ok || !body.access_token) {
    if (body.error === 'invalid_client') {
      throw new UserFacingError('France Travail refuse les clés enregistrées : vérifiez-les sur francetravail.io')
    }
    if (body.error === 'invalid_scope') {
      throw new UserFacingError('Votre application France Travail n\'est pas abonnée à l\'API Offres d\'emploi')
    }
    throw new Error(`Authentification France Travail impossible (HTTP ${response.status})`)
  }

  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 1200) * 1000 }
  return cachedToken.value
}

// Format attendu par l'API : 2026-09-27T08:00:00Z (sans millisecondes)
function toApiDate(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/**
 * Offres publiées entre `since` et maintenant, pour ces codes ROME et départements.
 * Parcourt les pages jusqu'à `maxOffers`, les plus récentes d'abord.
 */
export async function fetchJobOffers(
  departments: string[],
  romeCodes: string[],
  since: Date,
  maxOffers: number
): Promise<JobOffer[]> {
  const token = await accessToken()
  const offers: JobOffer[] = []

  for (let index = 0; index < departments.length; index += MAX_DEPARTMENTS_PER_SEARCH) {
    const departmentBatch = departments.slice(index, index + MAX_DEPARTMENTS_PER_SEARCH)

    for (let start = 0; start <= MAX_RANGE_END && offers.length < maxOffers; start += OFFERS_PAGE_SIZE) {
      const end = Math.min(start + OFFERS_PAGE_SIZE - 1, MAX_RANGE_END)
      const params = new URLSearchParams({
        departement: departmentBatch.join(','),
        codeROME: romeCodes.join(','),
        minCreationDate: toApiDate(since),
        maxCreationDate: toApiDate(new Date()),
        // 1 = date de création décroissante
        sort: '1',
        range: `${start}-${end}`,
      })

      const response = await fetch(`${SEARCH_URL}?${params}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      // 204 : aucune offre
      if (response.status === 204) break

      // 200 : dernière page, 206 : il en reste d'autres
      if (response.status !== 200 && response.status !== 206) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Recherche France Travail impossible (HTTP ${response.status}) ${detail.slice(0, 200)}`)
      }

      const body = (await response.json()) as { resultats?: JobOffer[] }
      offers.push(...(body.resultats ?? []))

      if (response.status === 200) break
    }
  }

  return offers.slice(0, maxOffers)
}

export function offerUrl(offer: JobOffer): string {
  return offer.origineOffre?.urlOrigine ?? `https://candidat.francetravail.fr/offres/recherche/detail/${offer.id}`
}
