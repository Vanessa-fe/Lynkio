'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'
import { nafCodesForGroups } from '@/lib/constants/client-sectors'
import { strategySchema, type StrategyInput } from '@/lib/validations/strategy'
import { getCurrentPlan } from '@/lib/queries/billing'
import { NO_ACCESS_MESSAGE, PLAN_LIMITS } from '@/lib/billing'

type ActionResult = { success: boolean; error?: string; id?: string }

const UNIQUE_VIOLATION = '23505'

function filtersFrom(input: StrategyInput) {
  return {
    sector_groups: input.sectorGroups,
    // Codes NAF envoyés au registre ; recalculés à chaque enregistrement depuis le catalogue
    naf_codes: nafCodesForGroups(input.sectorGroups),
    sizes: input.sizes,
    departments: input.departments,
  }
}

function errorFrom(error: unknown, fallback: string): string {
  if (error instanceof ZodError) return error.errors[0]?.message ?? 'Données invalides'
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === UNIQUE_VIOLATION) return 'Vous avez déjà une recherche avec ce nom'
    if (error.code === 'P0001' && 'message' in error && typeof error.message === 'string') return error.message
  }
  return fallback
}

/** Enregistre une nouvelle recherche (active tout de suite) */
export async function createStrategy(input: StrategyInput): Promise<ActionResult> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }
  try {
    const validated = strategySchema.parse(input)
    const supabase = await createClient()

    // Nombre de recherches permis par l'offre (5 en Essentiel, 20 en Pro)
    const plan = await getCurrentPlan()
    if (!plan) return { success: false, error: NO_ACCESS_MESSAGE }
    const { count } = await supabase
      .from('prospect_strategies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
    const max = PLAN_LIMITS[plan].strategies
    if ((count ?? 0) >= max) {
      return {
        success: false,
        error:
          plan === 'pro'
            ? `Vous avez déjà ${max} recherches : supprimez-en une pour en créer une nouvelle.`
            : `Vous avez déjà ${max} recherches, le maximum de l’offre Essentiel. Supprimez-en une, ou passez à l’offre Pro (${PLAN_LIMITS.pro.strategies} recherches).`,
      }
    }

    const { data, error } = await supabase
      .from('prospect_strategies')
      .insert({ user_id: user.id, name: validated.name, approach: validated.approach, filters: filtersFrom(validated) })
      .select('id')
      .single()
    if (error) throw error

    captureServerEvent(user.id, 'strategy_created', {
      approach: validated.approach,
      sectors: validated.sectorGroups.length,
      departments: validated.departments.length,
    })
    revalidatePath('/prospection')
    return { success: true, id: data.id }
  } catch (error) {
    if (!(error instanceof ZodError)) captureServerError(error, user.id, { action: 'create_strategy' })
    return { success: false, error: errorFrom(error, 'Impossible d’enregistrer la recherche') }
  }
}

/** Modifie une recherche : de nouveaux filtres font repartir Sophie du début des résultats */
export async function updateStrategy(id: string, input: StrategyInput): Promise<ActionResult> {
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }
  try {
    const validated = strategySchema.parse(input)
    const supabase = await createClient()
    const { error } = await supabase
      .from('prospect_strategies')
      .update({ name: validated.name, approach: validated.approach, filters: filtersFrom(validated) })
      .eq('id', id)
    if (error) throw error
    revalidatePath('/prospection')
    return { success: true, id }
  } catch (error) {
    if (!(error instanceof ZodError)) captureServerError(error, user.id, { action: 'update_strategy' })
    return { success: false, error: errorFrom(error, 'Impossible de modifier la recherche') }
  }
}

/** Active ou met en pause une recherche (une recherche en pause ne passe plus automatiquement) */
export async function setStrategyActive(id: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('prospect_strategies').update({ is_active: isActive }).eq('id', id)
  if (error) return { success: false, error: 'Impossible de modifier la recherche' }
  revalidatePath('/prospection')
  return { success: true }
}

/** Supprime une recherche ; les entreprises qu'elle a trouvées restent */
export async function deleteStrategy(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('prospect_strategies').delete().eq('id', id)
  if (error) return { success: false, error: 'Impossible de supprimer la recherche' }
  revalidatePath('/prospection')
  return { success: true }
}
