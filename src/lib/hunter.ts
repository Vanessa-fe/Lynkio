import 'server-only'
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Recherches Hunter.io avec la clé de l'utilisateur (Paramètres > Vos clés). Elles passent par la
 * fonction Supabase `hunter`, qui déchiffre la clé : elle ne quitte jamais Supabase.
 * Hunter ne facture aucun crédit quand une recherche ciblée (Email Finder) ne trouve rien.
 */

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

/**
 * Appel à Hunter (domain-search ou email-finder) via la fonction Supabase `hunter`.
 * Renvoie le statut et le corps de la réponse de Hunter.
 */
export async function hunterRequest(
  supabase: SupabaseClient,
  endpoint: 'domain-search' | 'email-finder',
  params: Record<string, string | number>
): Promise<{ status: number; body: unknown }> {
  const { data, error } = await supabase.functions.invoke<{ status: number; body: unknown }>('hunter', {
    body: { endpoint, params },
  })
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as { error?: string } | null
    throw new HunterError(payload?.error ?? 'Impossible d\'interroger Hunter.io pour le moment', error.context.status)
  }
  if (error || !data) throw new HunterError('Impossible d\'interroger Hunter.io pour le moment', 502)
  return data
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
  supabase: SupabaseClient,
  query: EmailFinderQuery
): Promise<(HunterPerson & { email: string }) | null> {
  const params: Record<string, string> =
    'linkedinHandle' in query
      ? { linkedin_handle: query.linkedinHandle }
      : {
          ...('domain' in query ? { domain: query.domain } : { company: query.company }),
          first_name: query.firstName,
          last_name: query.lastName,
        }
  const { status, body } = await hunterRequest(supabase, 'email-finder', params)
  // 404 : personne ou entreprise inconnue de Hunter
  if (status >= 400 && status !== 404) throw hunterError(status)

  const person = ((body as { data?: HunterPerson } | null)?.data ?? null) as HunterPerson | null
  return person?.email ? { ...person, email: person.email } : null
}
