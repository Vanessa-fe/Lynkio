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

/** Réponse d'erreur si l'offre ne suffit pas (null : c'est bon) */
export function planDenial(plan: Plan | null, needsPro: boolean): { message: string; code: 'no_access' | 'pro_only' } | null {
  if (!plan) return { message: NO_ACCESS_MESSAGE, code: 'no_access' }
  if (needsPro && plan !== 'pro') return { message: PRO_ONLY_MESSAGE, code: 'pro_only' }
  return null
}
