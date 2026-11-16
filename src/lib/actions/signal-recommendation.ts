'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { readOffer } from '@/lib/validations/offer'
import {
  capabilityForSignal,
  recommendedWeights,
  sanitizeRecommendedEvents,
  servicesFingerprint,
  type SignalRecommendation,
} from '../../../supabase/functions/_shared/signal-capabilities'

type ActionResult = { success: boolean; error?: string }

export type RecommendationDraft = {
  summary: string
  pitch: string
  events: unknown
  provider: string
}

const PROVIDERS = ['openai', 'gemini', 'anthropic']

/**
 * Applique la recommandation de Sophie (préparée par la fonction signal-advisor et montrée à
 * l'utilisateur). Tout est refiltré ici : le navigateur ne peut pas ajouter d'événement, de
 * prestation ou de points hors des bornes. Les réglages manuels (signal_weights) ne sont pas
 * touchés : ils restent prioritaires dans le score.
 */
export async function saveSignalRecommendation(draft: RecommendationDraft): Promise<ActionResult> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }

  const supabase = await createClient()
  const { data: icp, error: icpError } = await supabase
    .from('icp_profiles')
    .select('id, criteria')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (icpError || !icp) return { success: false, error: 'Client idéal introuvable' }

  const services = readOffer(icp.criteria).services
  const pitch = typeof draft.pitch === 'string' ? draft.pitch.replace(/[<>]/g, ' ').trim().slice(0, 600) : ''
  const events = sanitizeRecommendedEvents(
    draft.events,
    services.map((service) => service.name)
  )
  if (events.length === 0) return { success: false, error: 'Recommandation vide : demandez-en une nouvelle à Sophie' }

  // Signaux détectables aujourd'hui : disponibles en base ET créés par une capacité du registre
  const { data: types, error: typesError } = await supabase
    .from('signal_types')
    .select('key')
    .eq('is_active', true)
    .eq('availability', 'available')
  if (typesError) return { success: false, error: 'Impossible de lire le catalogue des signaux' }
  const detectable = (types ?? []).map((type) => type.key).filter((key) => capabilityForSignal(key))

  const recommendation: SignalRecommendation = {
    version: 1,
    generatedAt: new Date().toISOString(),
    provider: PROVIDERS.includes(draft.provider) ? draft.provider : '',
    servicesFingerprint: servicesFingerprint(services, pitch),
    pitch,
    summary: typeof draft.summary === 'string' ? draft.summary.replace(/[<>]/g, ' ').trim().slice(0, 400) : '',
    events,
    weights: recommendedWeights(events, detectable),
  }

  const { error } = await supabase
    .from('icp_profiles')
    .update({ signal_recommendations: recommendation })
    .eq('id', icp.id)
    .eq('user_id', user.id)
  if (error) {
    console.error('Save signal recommendation error:', error)
    return { success: false, error: 'Impossible d’enregistrer la recommandation' }
  }

  revalidatePath('/settings/icp')
  revalidatePath('/companies')
  return { success: true }
}
