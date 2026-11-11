// Relais vers Hunter avec la clé personnelle de l'utilisateur (Paramètres > Vos clés).
//
// La clé est déchiffrée ici et ne quitte jamais Supabase : le serveur du site appelle cette
// fonction avec le jeton de l'utilisateur, et reçoit seulement la réponse de Hunter.
//
// POST { endpoint: 'domain-search' | 'email-finder', params: { … } }
// Réponse : { status, body } (statut et corps de la réponse de Hunter), ou
// { error, missingKey: 'hunter' } (HTTP 400) quand l'utilisateur n'a pas de clé.
// Pas d'en-têtes CORS : un navigateur ne peut pas l'appeler depuis une autre page.

import { createClient } from '@supabase/supabase-js'
import { accountPlan, planDenial } from '../_shared/plan.ts'

const HUNTER_URL = 'https://api.hunter.io/v2'
const TIMEOUT_MS = 15_000
const MAX_PARAM_LENGTH = 200

// Seuls ces appels et ces paramètres sont relayés
const ALLOWED_PARAMS: Record<string, string[]> = {
  'domain-search': ['domain', 'limit'],
  'email-finder': ['domain', 'company', 'first_name', 'last_name', 'linkedin_handle'],
}

const MISSING_KEY_MESSAGE =
  'Ajoutez votre clé Hunter dans Paramètres > Vos clés (gratuite jusqu\'à 50 recherches par mois).'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  const input = (await request.json().catch(() => null)) as { endpoint?: unknown; params?: unknown } | null
  const endpoint = typeof input?.endpoint === 'string' ? input.endpoint : ''
  const allowed = ALLOWED_PARAMS[endpoint]
  if (!allowed || !input?.params || typeof input.params !== 'object') return json({ error: 'Demande invalide' }, 400)

  const params = new URLSearchParams()
  for (const name of allowed) {
    const value = (input.params as Record<string, unknown>)[name]
    if (typeof value === 'string' && value.trim() && value.length <= MAX_PARAM_LENGTH) params.set(name, value.trim())
    if (typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 100) params.set(name, String(value))
  }
  if (params.size === 0) return json({ error: 'Demande invalide' }, 400)

  const authorization = request.headers.get('Authorization') ?? ''
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  const userId = auth?.user?.id
  if (!userId) return json({ error: 'Vous devez être connecté' }, 401)

  // Recherche d'e-mails : offre Pro
  const denial = planDenial(await accountPlan(admin, userId), true)
  if (denial) return json({ error: denial.message, code: denial.code }, 403)

  const { data: keys, error } = await admin.rpc('read_user_api_key', { p_user_id: userId, p_provider: 'hunter' })
  if (error) {
    console.error('hunter: lecture de la clé impossible', error.message)
    return json({ error: 'Recherche Hunter indisponible pour le moment' }, 500)
  }
  const apiKey = ((keys ?? []) as { api_key: string }[])[0]?.api_key
  if (!apiKey) return json({ error: MISSING_KEY_MESSAGE, missingKey: 'hunter' }, 400)

  try {
    const response = await fetch(`${HUNTER_URL}/${endpoint}?${params}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = await response.json().catch(() => null)
    return json({ status: response.status, body })
  } catch (error) {
    console.error('hunter: appel impossible', error instanceof Error ? error.name : error)
    return json({ status: 504, body: null })
  }
})
