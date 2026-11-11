import type { Billing } from '@/types/models'

export type PlanKey = 'essentiel' | 'pro'
export type BillingInterval = 'month' | 'year'

export const PLAN_LABELS: Record<PlanKey, string> = { essentiel: 'Essentiel', pro: 'Pro' }

/** Ce que permet chaque offre (mêmes valeurs dans supabase/functions/_shared/plan.ts et sur la page Tarifs) */
export const PLAN_LIMITS: Record<PlanKey, { searchKeywords: number; companiesPerRun: number; daysPerWeek: number }> = {
  essentiel: { searchKeywords: 3, companiesPerRun: 10, daysPerWeek: 1 },
  pro: { searchKeywords: 10, companiesPerRun: 50, daysPerWeek: 7 },
}

export const NO_ACCESS_MESSAGE = 'Votre essai gratuit est terminé : choisissez une offre dans Paramètres > Abonnement.'
export const PRO_ONLY_MESSAGE = 'Réservé à l’offre Pro : vous pouvez changer d’offre dans Paramètres > Abonnement.'

/** États d'un abonnement Stripe qui donnent accès (past_due : Stripe retente le paiement quelques jours) */
const SUBSCRIBED = ['active', 'trialing', 'past_due']

const DAY_MS = 24 * 60 * 60 * 1000
// Stripe n'accepte une fin d'essai qu'au moins 48 heures plus tard (même seuil dans la fonction billing)
const MIN_TRIAL_KEPT_MS = 49 * 60 * 60 * 1000

export type Access = {
  allowed: boolean
  /** Offre appliquée : Pro pendant l'essai et pour les comptes offerts */
  plan: PlanKey | null
  kind: 'exempt' | 'subscription' | 'trial' | 'expired' | 'unknown'
  /** Jours d'essai restants (0 hors essai) */
  trialDaysLeft: number
  /** Le dernier paiement n'est pas passé : Stripe retente, l'accès est gardé en attendant */
  paymentIssue: boolean
  /** S'abonner maintenant garde les jours d'essai restants (premier prélèvement à la fin de l'essai) */
  keepsTrial: boolean
}

export type BillingState = Pick<Billing, 'exempt' | 'plan' | 'status' | 'trial_ends_at'>

/**
 * Ce à quoi le compte a droit : compte offert, abonnement en cours, essai gratuit, ou rien.
 * Sans ligne d'abonnement (cas anormal), on laisse entrer plutôt que de bloquer la personne.
 */
export function getAccess(billing: BillingState | null, now = Date.now()): Access {
  if (!billing) return { allowed: true, plan: 'pro', kind: 'unknown', trialDaysLeft: 0, paymentIssue: false, keepsTrial: false }
  if (billing.exempt) return { allowed: true, plan: 'pro', kind: 'exempt', trialDaysLeft: 0, paymentIssue: false, keepsTrial: false }

  if (billing.status && SUBSCRIBED.includes(billing.status)) {
    return {
      allowed: true,
      plan: billing.plan === 'essentiel' ? 'essentiel' : 'pro',
      kind: 'subscription',
      trialDaysLeft: 0,
      paymentIssue: billing.status === 'past_due',
      keepsTrial: false,
    }
  }

  const left = new Date(billing.trial_ends_at).getTime() - now
  if (left > 0) {
    return {
      allowed: true,
      plan: 'pro',
      kind: 'trial',
      trialDaysLeft: Math.ceil(left / DAY_MS),
      paymentIssue: false,
      keepsTrial: left > MIN_TRIAL_KEPT_MS,
    }
  }
  return { allowed: false, plan: null, kind: 'expired', trialDaysLeft: 0, paymentIssue: false, keepsTrial: false }
}
