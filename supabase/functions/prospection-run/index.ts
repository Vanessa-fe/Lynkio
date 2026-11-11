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
import type { SupabaseClient } from '@supabase/supabase-js'
import { runProspection, startRun } from './runner.ts'
import { accountPlan, NO_ACCESS_MESSAGE, parisMidnight, PLAN_LIMITS, PRO_ONLY_MESSAGE, type Plan } from '../_shared/plan.ts'

// Fourni par le runtime Supabase : garde la fonction en vie après la réponse
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const SCHEDULED_BATCH_SIZE = 20

/**
 * Offre Essentiel : une recherche par semaine, comptée au jour près (heure de Paris) : après une
 * recherche un mercredi, la suivante est possible dès le mercredi d'après à minuit. Compter 7 jours
 * à la seconde près ferait sauter une semaine sur deux la recherche planifiée, qui ne démarre pas
 * toujours à la même seconde. Renvoie la date à partir de laquelle la suivante est possible, ou null
 * si elle l'est déjà (les passages échoués ne comptent pas). Même règle dans src/lib/queries/prospection.ts.
 */
async function nextWeeklyRun(admin: SupabaseClient, userId: string, plan: Plan): Promise<Date | null> {
  if (PLAN_LIMITS[plan].runsPerWeek === null) return null
  const { data } = await admin
    .from('pipeline_runs')
    .select('started_at')
    .eq('user_id', userId)
    .neq('status', 'failed')
    .gte('started_at', parisMidnight(new Date(), -6).toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? parisMidnight(new Date(data.started_at), 7) : null
}

const frenchDay = (date: Date) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }).format(date)

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

    const plan = await accountPlan(admin, data.user.id)
    if (!plan) return json({ error: NO_ACCESS_MESSAGE, code: 'no_access' }, 403)
    if (body.source === 'tech_users' && plan !== 'pro') return json({ error: PRO_ONLY_MESSAGE, code: 'pro_only' }, 403)
    const nextRun = await nextWeeklyRun(admin, data.user.id, plan)
    if (nextRun) {
      return json(
        {
          error: `Avec l’offre Essentiel, Sophie cherche une fois par semaine : prochaine recherche possible ${frenchDay(nextRun)}. L’offre Pro la fait chercher jusqu’à 7 jours sur 7.`,
          code: 'weekly_limit',
        },
        429
      )
    }

    const start = await startRun(admin, data.user.id, 'manual')
    if (!start.ok) {
      return json({ error: start.error }, 409)
    }

    // « Recherche par technologie » : seulement cette source, lancée à la demande
    const only = body.source === 'tech_users' ? ['tech_users' as const] : undefined
    EdgeRuntime.waitUntil(runProspection(admin, data.user.id, start.runId, only, PLAN_LIMITS[plan]))
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
          // Essai terminé sans abonnement, ou recherche de la semaine déjà faite (Essentiel) : rien
          const plan = await accountPlan(admin, userId)
          if (!plan || (await nextWeeklyRun(admin, userId, plan))) continue
          const start = await startRun(admin, userId, 'schedule')
          if (start.ok) {
            await runProspection(admin, userId, start.runId, undefined, PLAN_LIMITS[plan])
          }
        }
      })()
    )

    return json({ claimed: userIds.length }, 202)
  }

  return json({ error: 'Mode inconnu' }, 400)
})
