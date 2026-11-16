import { createClient } from '@/lib/supabase/server'
import type { IcpProfile } from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'
import { signalAvailability, type SignalAvailability } from '@/lib/constants/signals'
import { readOffer } from '@/lib/validations/offer'
import {
  capabilityForSignal,
  opportunityEvent,
  readSignalRecommendation,
  signalDetection,
  servicesFingerprint,
} from '../../../supabase/functions/_shared/signal-capabilities'

export type SignalWeightOption = {
  key: string
  label: string
  description: string | null
  // Points recommandés : ceux de Sophie s'il y a une recommandation, sinon ceux du métier (0 sinon)
  defaultWeight: number
  // Signal mis en avant : recommandé par Sophie, ou utile au métier en l'absence de recommandation
  isSuggested: boolean
  // Pourquoi Sophie le recommande, et pour quelle prestation
  recommendation: { why: string; service: string } | null
  // Détecté aujourd'hui, ou pas encore (les signaux retirés ne sont pas chargés)
  availability: SignalAvailability
  // Comment Sophie le repère (registre des capacités), null s'il n'est pas détectable
  detection: string | null
  // Repéré automatiquement, ou par « Approfondir avec Sophie »
  mode: 'automatic' | 'deep' | null
}

/** Recommandation de Sophie telle que l'écran la montre */
export type RecommendationView = {
  generatedAt: string
  summary: string
  pitch: string
  // Les prestations ont changé depuis : proposer une nouvelle recommandation
  isStale: boolean
  events: { key: string; label: string; service: string; why: string; weight: number; mode: 'automatic' | 'deep' | null }[]
}

/**
 * Client idéal actif de l'utilisateur, avec les signaux et leurs poids par défaut
 */
export async function getIcpSettings(): Promise<{
  icp: IcpProfile
  signals: SignalWeightOption[]
  companiesCount: number
  professionKey: string | null
  // Mots-clés de recherche proposés pour le métier
  suggestedKeywords: string[]
  recommendation: RecommendationView | null
  // Noms des prestations (Mon offre)
  services: string[]
} | null> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return null
  }

  const [{ data: icp }, { data: profile }, { data: signalTypes }, { count }] = await Promise.all([
    supabase
      .from('icp_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
    supabase.from('user_profiles').select('profession_key').eq('id', user.id).maybeSingle(),
    // Les types retirés (source arrêtée) sont inactifs : ils ne sont pas proposés
    supabase
      .from('signal_types')
      .select('key, label, description, availability')
      .eq('is_active', true)
      .neq('availability', 'retired')
      .order('label'),
    supabase.from('companies').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  if (!icp) {
    return null
  }

  const professionKey = icp.profession_key ?? profile?.profession_key ?? null
  const [{ data: professionSignals }, { data: profession }] = professionKey
    ? await Promise.all([
        supabase.from('profession_signals').select('signal_type, default_weight').eq('profession_key', professionKey),
        supabase.from('professions').select('suggested_keywords').eq('key', professionKey).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }]

  const defaults = new Map((professionSignals ?? []).map((row) => [row.signal_type, row.default_weight]))
  const recommendation = readSignalRecommendation(icp.signal_recommendations)
  const services = readOffer(icp.criteria).services

  // Signal → événement recommandé qui le détecte (raison et prestation)
  const recommendedBySignal = new Map(
    (recommendation?.events ?? []).flatMap((event) => {
      const signal = opportunityEvent(event.event)?.signal
      return signal ? [[signal, event] as const] : []
    })
  )

  const signals = (signalTypes ?? [])
    .map((type) => {
      const recommended = recommendedBySignal.get(type.key)
      const defaultWeight = recommendation
        ? (recommendation.weights[type.key] ?? 0)
        : (defaults.get(type.key) ?? 0)
      return {
        key: type.key,
        label: type.label,
        description: type.description,
        defaultWeight,
        isSuggested: recommendation ? defaultWeight > 0 : defaults.has(type.key),
        recommendation: recommended ? { why: recommended.why, service: recommended.service } : null,
        ...detectability(type.key, type.availability),
      }
    })
    // Les signaux mis en avant d'abord, les plus importants en haut
    .sort((a, b) => Number(b.isSuggested) - Number(a.isSuggested) || b.defaultWeight - a.defaultWeight)

  const recommendationView: RecommendationView | null = recommendation
    ? {
        generatedAt: recommendation.generatedAt,
        summary: recommendation.summary,
        pitch: recommendation.pitch,
        isStale: recommendation.servicesFingerprint !== servicesFingerprint(services, recommendation.pitch),
        events: recommendation.events.map((event) => {
          const definition = opportunityEvent(event.event)
          const signal = definition?.signal ?? null
          return {
            key: event.event,
            label: definition?.label ?? event.event,
            service: event.service,
            why: event.why,
            weight: event.weight,
            mode: signal && signals.some((option) => option.key === signal && option.availability === 'available') ? signalDetection(signal) : null,
          }
        }),
      }
    : null

  return {
    icp,
    signals,
    companiesCount: count ?? 0,
    professionKey,
    suggestedKeywords: profession?.suggested_keywords ?? [],
    recommendation: recommendationView,
    services: services.map((service) => service.name),
  }
}

/**
 * Tarif journalier et technologies du client idéal actif (budget des entreprises)
 */
export async function getIcpBasics(): Promise<{ dayRate: number | null; techStack: string[]; professionKey: string | null }> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return { dayRate: null, techStack: [], professionKey: null }
  }

  const { data } = await supabase
    .from('icp_profiles')
    .select('criteria, profession_key')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle()

  const criteria = (data?.criteria ?? {}) as { day_rate?: unknown; tech_stack?: unknown }
  return {
    dayRate: typeof criteria.day_rate === 'number' ? criteria.day_rate : null,
    techStack: Array.isArray(criteria.tech_stack)
      ? criteria.tech_stack.filter((tech): tech is string => typeof tech === 'string')
      : [],
    professionKey: data?.profession_key ?? null,
  }
}

/**
 * Un signal n'est détectable que si la base le dit disponible ET qu'une capacité du registre le crée :
 * en cas de désaccord, il reste indisponible (jamais de points pour un signal que rien ne vérifie).
 */
function detectability(key: string, availability: string | null): Pick<SignalWeightOption, 'availability' | 'detection' | 'mode'> {
  const capability = capabilityForSignal(key)
  const declared = signalAvailability(availability)
  if (declared === 'available' && capability) {
    return { availability: 'available', detection: capability.detectionLabel, mode: signalDetection(key) }
  }
  return { availability: declared === 'retired' ? 'retired' : 'unavailable', detection: null, mode: null }
}
