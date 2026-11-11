// Offre du compte (base : public.account_plan) et ce qu'elle permet.
// Mêmes limites que src/lib/billing.ts (PLAN_LIMITS), affichées sur la page Tarifs.

import type { SupabaseClient } from '@supabase/supabase-js'

export type Plan = 'essentiel' | 'pro'

export const PLAN_LIMITS: Record<Plan, { searchKeywords: number; companiesPerRun: number; runsPerWeek: number | null }> = {
  essentiel: { searchKeywords: 3, companiesPerRun: 10, runsPerWeek: 1 },
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
 * une recherche par semaine, comptée au jour près (même règle dans src/lib/billing.ts).
 */
export function parisMidnight(date: Date, days = 0): Date {
  const [year = 1970, month = 1, day = 1] = new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(date)
    .split('-')
    .map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day + days)
  return new Date(utcMidnight - parisOffsetMs(new Date(utcMidnight)))
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
