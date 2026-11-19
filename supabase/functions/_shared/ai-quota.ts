// IA incluse dans l'offre Pro (décision du 19/11/2026) : un compte Pro, ou en essai, qui n'a pas sa
// propre clé utilise la clé OpenAI de Filonea (secret FILONEA_OPENAI_API_KEY), dans la limite de quotas
// par mois (heure de Paris). Avec sa propre clé, pas de quota : c'est son fournisseur qui facture.
// Mêmes quotas que src/lib/ai-quota.ts (affichés dans Paramètres > Vos clés).
//
// Coût mesuré le 19/11/2026 (gpt-5.6-terra) : message préparé ~0,004 $, « Approfondir » ~0,09 $ (max 0,13 $).
// Un compte Pro au maximum de tous ses quotas : ~6 $ par mois.

import { parisMidnight } from './plan.ts'

export type AiAction = 'draft' | 'chat' | 'deep_dive' | 'assistant' | 'linkedin_sort'

export const AI_ACTIONS: AiAction[] = ['draft', 'chat', 'deep_dive', 'assistant', 'linkedin_sort']

/** Quotas par mois de l'offre Pro ; pendant l'essai, la moitié */
export const AI_QUOTAS: Record<AiAction, number> = {
  draft: 300,
  chat: 300,
  deep_dive: 40,
  assistant: 60,
  linkedin_sort: 400,
}

/** Ce que compte chaque quota, dans les messages (« vos 40 analyses « Approfondir » ») */
export const AI_ACTION_LABELS: Record<AiAction, string> = {
  draft: 'messages préparés par Sophie',
  chat: 'questions posées à Sophie',
  deep_dive: 'analyses « Approfondir »',
  assistant: 'aides de Sophie (recommandations, stratégies, bilans)',
  linkedin_sort: 'tris de posts LinkedIn',
}

export function aiQuota(action: AiAction, trial: boolean): number {
  return trial ? Math.floor(AI_QUOTAS[action] / 2) : AI_QUOTAS[action]
}

/** Début du mois en cours, à minuit heure de Paris */
export function parisMonthStart(now: Date): Date {
  const day = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', day: 'numeric' }).format(now))
  return parisMidnight(now, -(day - 1))
}

/** « 1er décembre » : le jour où les compteurs repartent à zéro */
export function nextResetLabel(now: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', month: 'numeric', year: 'numeric' }).formatToParts(now)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const next = new Date(Date.UTC(month === 12 ? year + 1 : year, month % 12, 15))
  return `1er ${new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(next)}`
}

export const ESSENTIEL_AI_MESSAGE =
  'L’IA est incluse dans l’offre Pro. Avec l’offre Essentiel, ajoutez votre propre clé dans Paramètres > Vos clés, ou passez en Pro dans Paramètres > Abonnement.'

export function quotaReachedMessage(action: AiAction, quota: number, now: Date): string {
  return `Vous avez utilisé vos ${quota} ${AI_ACTION_LABELS[action]} inclus ce mois-ci. Le compteur repart à zéro le ${nextResetLabel(now)}. Pour continuer dès maintenant, ajoutez votre propre clé dans Paramètres > Vos clés.`
}
