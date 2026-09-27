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

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
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
      tech_stack: validated.techStack,
    }

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
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Réglages invalides' }
    }
    console.error('Save ICP error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
