import type { Billing } from '@/types/models'

export type PlanKey = 'essentiel' | 'pro'
export type BillingInterval = 'month' | 'year'

export const PLAN_LABELS: Record<PlanKey, string> = { essentiel: 'Essentiel', pro: 'Pro' }

/**
 * Ce que permet chaque offre, décision du 15/11/2026 : Essentiel 9 €, Pro 20 € par mois
 * (mêmes valeurs dans supabase/functions/_shared/plan.ts et sur la page Tarifs)
 */
export const PLAN_LIMITS: Record<
  PlanKey,
  {
    searchKeywords: number
    companiesPerRun: number
    daysPerWeek: number
    runsPerWeek: number | null
    // Recherches enregistrées (recherche par profil), décision du 13/11/2026
    strategies: number
    // Lancements à la main par jour (heure de Paris), décision du 12/11/2026 ; même plafond en base (00057)
    manualRunsPerDay: number
  }
> = {
  essentiel: { searchKeywords: 6, companiesPerRun: 20, daysPerWeek: 2, runsPerWeek: 2, strategies: 5, manualRunsPerDay: 5 },
  pro: { searchKeywords: 10, companiesPerRun: 50, daysPerWeek: 7, runsPerWeek: null, strategies: 20, manualRunsPerDay: 5 },
}

const PARIS = 'Europe/Paris'

/**
 * Minuit (heure de Paris) du jour de `date`, décalé de `days` jours. Sert à la limite Essentiel :
 * recherches par semaine, comptées au jour près (même règle dans supabase/functions/_shared/plan.ts).
 */
/** Début du mois en cours, à minuit heure de Paris (quotas d'IA incluse, src/lib/ai-quota.ts) */
export function parisMonthStart(now: Date): Date {
  const day = Number(new Intl.DateTimeFormat('en-CA', { timeZone: PARIS, day: 'numeric' }).format(now))
  return parisMidnight(now, -(day - 1))
}

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
 * Même règle dans supabase/functions/_shared/plan.ts et en base (00064_empty_runs_not_counted.sql).
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
