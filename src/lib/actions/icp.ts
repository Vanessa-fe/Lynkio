'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  icpSchema,
  sizeCategoriesFromFit,
  type IcpCriteria,
  type IcpInput,
} from '@/lib/validations/icp'
import { getAuthUser } from '@/lib/supabase/auth'
import { getCurrentPlan } from '@/lib/queries/billing'
import { NO_ACCESS_MESSAGE, PLAN_LIMITS } from '@/lib/billing'

type ActionResult = {
  success: boolean
  error?: string
}

/**
 * Enregistre le client idéal. La base incrémente sa version et recalcule
 * aussitôt le score de toutes les entreprises de l'utilisateur (trigger).
 */
export async function saveIcp(icpId: string, input: IcpInput): Promise<ActionResult> {
  try {
    const validated = icpSchema.parse(input)
    const supabase = await createClient()

    const user = await getAuthUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const plan = await getCurrentPlan()
    if (!plan) return { success: false, error: NO_ACCESS_MESSAGE }
    const maxKeywords = PLAN_LIMITS[plan].searchKeywords
    if (validated.searchKeywords.length > maxKeywords) {
      return {
        success: false,
        error: `Au plus ${maxKeywords} mots-clés de recherche avec l’offre ${plan === 'pro' ? 'Pro' : 'Essentiel'}.`,
      }
    }

    const { data: icp } = await supabase
      .from('icp_profiles')
      .select('criteria, profession_key')
      .eq('id', icpId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!icp) {
      return { success: false, error: 'Client idéal introuvable' }
    }

    // Poids par défaut du métier : seuls les écarts sont enregistrés, pour qu'une
    // évolution des valeurs par défaut profite aux signaux non modifiés
    const professionKey = icp.profession_key
    const { data: defaults } = professionKey
      ? await supabase.from('profession_signals').select('signal_type, default_weight').eq('profession_key', professionKey)
      : { data: [] }
    const defaultWeights = new Map((defaults ?? []).map((row) => [row.signal_type, row.default_weight]))

    const signalWeights = Object.fromEntries(
      Object.entries(validated.signalWeights).filter(
        ([signalType, weight]) => weight !== (defaultWeights.get(signalType) ?? 0)
      )
    )

    // Les critères non gérés par cet écran (pays, télétravail…) sont conservés
    const criteria: IcpCriteria = {
      ...((icp.criteria ?? {}) as IcpCriteria),
      size_categories: sizeCategoriesFromFit(validated.sizeFit),
      exclude_keywords: validated.excludeKeywords,
      search_keywords: validated.searchKeywords,
      tech_stack: validated.techStack,
      ...(validated.dayRate ? { day_rate: validated.dayRate } : {}),
    }
    if (!validated.dayRate) delete criteria.day_rate

    const { error } = await supabase
      .from('icp_profiles')
      .update({ name: validated.name, criteria, signal_weights: signalWeights })
      .eq('id', icpId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Save ICP error:', error)
      return { success: false, error: 'Impossible d\'enregistrer votre client idéal' }
    }

    revalidatePath('/settings/icp')
    revalidatePath('/companies')
    revalidatePath('/prospection')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Réglages invalides' }
    }
    console.error('Save ICP error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Ajoute des mots-clés à exclure au client idéal (conversation guidée avec Sophie), sans toucher au reste.
 * Au plus 30 mots-clés au total, comme dans l'écran du client idéal.
 */
export async function addExcludedKeywords(keywords: string[]): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    const cleaned = icpSchema.shape.excludeKeywords.parse(keywords)
    if (cleaned.length === 0) return { success: true }

    const supabase = await createClient()
    const { data: icp } = await supabase
      .from('icp_profiles')
      .select('id, criteria')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!icp) return { success: false, error: 'Client idéal introuvable' }

    const criteria = (icp.criteria ?? {}) as IcpCriteria
    const merged = [...new Set([...(criteria.exclude_keywords ?? []), ...cleaned])].slice(0, 30)
    const { error } = await supabase
      .from('icp_profiles')
      .update({ criteria: { ...criteria, exclude_keywords: merged } })
      .eq('id', icp.id)
      .eq('user_id', user.id)
    if (error) {
      console.error('addExcludedKeywords', error)
      return { success: false, error: 'Impossible d’enregistrer les mots-clés à exclure' }
    }
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) return { success: false, error: error.errors[0]?.message ?? 'Mots-clés invalides' }
    console.error('addExcludedKeywords', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
