// Offre du compte (base : public.account_plan) et ce qu'elle permet.
// Mêmes limites que src/lib/billing.ts (PLAN_LIMITS), affichées sur la page Tarifs.

import type { SupabaseClient } from '@supabase/supabase-js'

export type Plan = 'essentiel' | 'pro'

export const PLAN_LIMITS: Record<Plan, { searchKeywords: number; companiesPerRun: number; runsPerWeek: number | null }> = {
  essentiel: { searchKeywords: 6, companiesPerRun: 20, runsPerWeek: 2 },
  pro: { searchKeywords: 10, companiesPerRun: 50, runsPerWeek: null },
}

export const NO_ACCESS_MESSAGE =
  'Votre essai gratuit est terminé : choisissez une offre dans Paramètres > Abonnement pour continuer.'
export const PRO_ONLY_MESSAGE = 'Réservé à l’offre Pro : vous pouvez changer d’offre dans Paramètres > Abonnement.'

/** Offre du compte, ou null si l'accès est terminé. Client service_role attendu. */
export async function accountPlan(admin: SupabaseClient, userId: string): Promise<Plan | null> {
  const { data, error } = await admin.rpc('account_plan', { p_user_id: userId })
  // Base injoignable : on n'empêche pas la personne de travailler
  if (error) {
    console.error('account_plan', error.message)
    return 'pro'
  }
  return data === 'essentiel' || data === 'pro' ? data : null
}

const PARIS = 'Europe/Paris'

/**
 * Minuit (heure de Paris) du jour de `date`, décalé de `days` jours. Sert à la limite Essentiel :
 * recherches par semaine, comptées au jour près (même règle dans src/lib/billing.ts).
 */
export function parisMidnight(date: Date, days = 0): Date {
  const [year = 1970, month = 1, day = 1] = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .split('-')
    .map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day + days)
  return new Date(utcMidnight - parisOffsetMs(new Date(utcMidnight)))
}

/**
 * Passages qui comptent dans les limites (recherches par semaine de l'offre Essentiel, lancements à la
 * main par jour) : celui en cours, sinon on pourrait en lancer plusieurs à la fois, et ceux terminés
 * avec au moins une entreprise ajoutée. Une recherche sans résultat, ou échouée, ne compte pas.
 * Même règle dans src/lib/billing.ts et en base (00064_empty_runs_not_counted.sql).
 */
export function runCountsTowardLimits(run: { status: string; companies_created: number }): boolean {
  return run.status === 'running' || (run.status === 'succeeded' && run.companies_created > 0)
}

/** runCountsTowardLimits, en filtre de requête : .or(COUNTED_RUNS_FILTER) sur pipeline_runs */
export const COUNTED_RUNS_FILTER = 'status.eq.running,and(status.eq.succeeded,companies_created.gt.0)'

/**
 * Limite Essentiel : N recherches par semaine, comptées au jour près (heure de Paris). Chaque recherche
 * libère sa place 7 jours plus tard à minuit : après des recherches lundi et jeudi, la suivante est
 * possible dès le lundi d'après. Compter 7 jours à la seconde près ferait sauter une recherche planifiée,
 * qui ne démarre pas toujours à la même seconde. `recentStarts` : débuts des recherches qui comptent
 * (runCountsTowardLimits) depuis parisMidnight(maintenant, -6), les plus récentes d'abord. Renvoie la date à partir de laquelle
 * la suivante est possible, ou null si elle l'est déjà.
 */
export function weeklyRunAvailableAt(recentStarts: Date[], runsPerWeek: number | null): Date | null {
  if (runsPerWeek === null || recentStarts.length < runsPerWeek) return null
  return parisMidnight(recentStarts[runsPerWeek - 1]!, 7)
}

/** Avance de l'heure de Paris sur l'heure UTC à cet instant (1 h en hiver, 2 h en été) */
function parisOffsetMs(date: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: PARIS,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  )
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  return asUtc - Math.floor(date.getTime() / 60_000) * 60_000
}

/** Réponse d'erreur si l'offre ne suffit pas (null : c'est bon) */
export function planDenial(plan: Plan | null, needsPro: boolean): { message: string; code: 'no_access' | 'pro_only' } | null {
  if (!plan) return { message: NO_ACCESS_MESSAGE, code: 'no_access' }
  if (needsPro && plan !== 'pro') return { message: PRO_ONLY_MESSAGE, code: 'pro_only' }
  return null
}
