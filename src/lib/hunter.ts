import 'server-only'
import { readUserApiKey } from '@/lib/supabase/admin'

/**
 * Recherche ciblée d'un e-mail avec Hunter.io (Email Finder), à partir du nom de la personne
 * et du site de son entreprise, de son profil LinkedIn, ou du nom de son entreprise.
 * Hunter ne facture aucun crédit quand la recherche ne trouve rien.
 */

const EMAIL_FINDER_URL = 'https://api.hunter.io/v2/email-finder'
const TIMEOUT_MS = 15_000

export type HunterPerson = {
  email: string | null
  first_name: string | null
  last_name: string | null
  position: string | null
  linkedin_url: string | null
  score: number | null
}

export type EmailFinderQuery =
  | { domain: string; firstName: string; lastName: string }
  | { linkedinHandle: string }
  | { company: string; firstName: string; lastName: string }

export class HunterError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

/** Erreur lisible pour une réponse en échec de Hunter */
export function hunterError(status: number): HunterError {
  if (status === 401 || status === 403) {
    return new HunterError('Hunter refuse votre clé ou votre quota est épuisé : vérifiez-la dans Paramètres > Vos clés', status)
  }
  if (status === 429) return new HunterError('Trop de requêtes envoyées à Hunter.io, réessayez dans un instant', 429)
  return new HunterError('Impossible d\'interroger Hunter.io pour le moment', 502)
}

// Message montré quand l'utilisateur n'a pas encore enregistré sa clé
export const MISSING_HUNTER_KEY_MESSAGE =
  'Ajoutez votre clé Hunter dans Paramètres > Vos clés (gratuite jusqu\'à 50 recherches par mois).'

/** Clé Hunter de l'utilisateur (Paramètres > Vos clés), déchiffrée côté serveur */
export async function hunterApiKey(userId: string): Promise<string | null> {
  return (await readUserApiKey(userId, 'hunter'))?.apiKey ?? null
}

/**
 * Nom public d'un profil LinkedIn (linkedin.com/in/<nom>), lisible par Hunter. Les identifiants
 * internes (« ACoAA… », donnés par LinkedIn pour les profils hors réseau) ne lui disent rien.
 */
export function linkedinHandle(profileUrl: string | null | undefined): string | null {
  const handle = profileUrl?.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]
  return handle && !/^ACoA/.test(handle) ? decodeURIComponent(handle) : null
}

/** La personne trouvée par Hunter, ou null s'il n'a pas d'e-mail pour elle */
export async function findEmail(
  query: EmailFinderQuery,
  apiKey: string
): Promise<(HunterPerson & { email: string }) | null> {
  const params = new URLSearchParams(
    'linkedinHandle' in query
      ? { linkedin_handle: query.linkedinHandle }
      : {
          ...('domain' in query ? { domain: query.domain } : { company: query.company }),
          first_name: query.firstName,
          last_name: query.lastName,
        }
  )
  const response = await fetch(`${EMAIL_FINDER_URL}?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  // 404 : personne ou entreprise inconnue de Hunter
  if (!response.ok && response.status !== 404) throw hunterError(response.status)

  const json = await response.json().catch(() => null)
  const person: HunterPerson | null = json?.data || null
  return person?.email ? { ...person, email: person.email } : null
}
