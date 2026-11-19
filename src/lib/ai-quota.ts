// IA incluse dans l'offre Pro (décision du 19/11/2026) : un compte Pro, ou en essai, sans clé personnelle
// utilise la clé de Filonea, dans la limite de quotas par mois (heure de Paris). Avec sa propre clé :
// pas de quota, c'est son fournisseur qui facture. Essentiel : sa propre clé, ou pas d'IA.
// Mêmes quotas que supabase/functions/_shared/ai-quota.ts, qui les applique (vérifié par npm run check).

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

/** Libellés dans Paramètres > Vos clés */
export const AI_QUOTA_LABELS: Record<AiAction, string> = {
  draft: 'Brouillons de messages',
  chat: 'Messages à Sophie',
  deep_dive: 'Analyses « Approfondir »',
  assistant: 'Aides de Sophie (recommandations, stratégies, bilans)',
  linkedin_sort: 'Tris de posts LinkedIn (extension)',
}

export function aiQuota(action: AiAction, trial: boolean): number {
  return trial ? Math.floor(AI_QUOTAS[action] / 2) : AI_QUOTAS[action]
}
