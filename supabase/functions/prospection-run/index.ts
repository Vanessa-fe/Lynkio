// Sophie : prospection automatique.
//
// Deux façons de l'appeler (POST, JSON) :
// - { "mode": "manual" } depuis l'application (« Lancer maintenant »), avec le
//   jeton de l'utilisateur connecté dans l'en-tête Authorization ;
//   { "mode": "manual", "source": "tech_users" } lance seulement la recherche
//   par technologie (recherche IA, à la demande) ;
// - { "mode": "scheduled" } toutes les heures par pg_cron. Ce mode ne traite que
//   les plannings arrivés à échéance (réservés atomiquement par la base) : un
//   appel en trop ne déclenche donc rien de plus que ce qui était prévu.
//
// La fonction est déployée sans vérification JWT par la passerelle
// (voir config.toml) : le mode manuel vérifie lui-même le jeton.
//
// Elle répond tout de suite (202) et poursuit le travail en arrière-plan : un
// passage peut durer plus longtemps que ce qu'accepte l'hébergement de l'application.

import { createClient } from '@supabase/supabase-js'
import { runProspection, startRun } from './runner.ts'

// Fourni par le runtime Supabase : garde la fonction en vie après la réponse
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const SCHEDULED_BATCH_SIZE = 20

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json({ error: 'Méthode non autorisée' }, 405)
  }

  let body: { mode?: string; source?: string } = {}
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Corps de requête invalide' }, 400)
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (body.mode === 'manual') {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    const { data, error } = token ? await admin.auth.getUser(token) : { data: { user: null }, error: null }

    if (error || !data.user) {
      return json({ error: 'Vous devez être connecté' }, 401)
    }

    const start = await startRun(admin, data.user.id, 'manual')
    if (!start.ok) {
      return json({ error: start.error }, 409)
    }

    // « Recherche par technologie » : seulement cette source, lancée à la demande
    const only = body.source === 'tech_users' ? ['tech_users' as const] : undefined
    EdgeRuntime.waitUntil(runProspection(admin, data.user.id, start.runId, only))
    return json({ runId: start.runId }, 202)
  }

  if (body.mode === 'scheduled') {
    const { data, error } = await admin.rpc('claim_due_prospection_runs', { p_limit: SCHEDULED_BATCH_SIZE })

    if (error) {
      console.error('claim_due_prospection_runs', error)
      return json({ error: 'Impossible de lire les plannings' }, 500)
    }

    // PostgREST renvoie une liste de valeurs pour une fonction SETOF uuid
    const userIds = ((data ?? []) as unknown[])
      .map((row) =>
        typeof row === 'string' ? row : (row as { claim_due_prospection_runs?: string }).claim_due_prospection_runs
      )
      .filter((id): id is string => typeof id === 'string')

    EdgeRuntime.waitUntil(
      (async () => {
        for (const userId of userIds) {
          const start = await startRun(admin, userId, 'schedule')
          if (start.ok) {
            await runProspection(admin, userId, start.runId)
          }
        }
      })()
    )

    return json({ claimed: userIds.length }, 202)
  }

  return json({ error: 'Mode inconnu' }, 400)
})
