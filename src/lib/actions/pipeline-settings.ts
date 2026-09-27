'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  AUTOMATIC_SOURCE_NAME,
  sourceSchema,
  stageSchema,
  type SourceInput,
  type StageInput,
} from '@/lib/validations/pipeline-settings'

type ActionResult = {
  success: boolean
  error?: string
}

const UNIQUE_VIOLATION = '23505'

function revalidate() {
  revalidatePath('/settings/pipeline')
  revalidatePath('/companies')
}

function failure(error: unknown, fallback: string): ActionResult {
  if (error instanceof ZodError) {
    return { success: false, error: error.errors[0]?.message ?? 'Données invalides' }
  }
  console.error(fallback, error)
  return { success: false, error: fallback }
}

async function currentUserId() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return { supabase, userId: user?.id ?? null }
}

type OrderedTable = 'pipeline_stages' | 'lead_sources'

/**
 * Échange la position d'un élément avec son voisin (au-dessus ou en dessous)
 */
async function move(table: OrderedTable, id: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const { supabase, userId } = await currentUserId()
  if (!userId) return { success: false, error: 'Vous devez être connecté' }

  const { data: rows, error } = await supabase
    .from(table)
    .select('id, order')
    .eq('user_id', userId)
    .order('order', { ascending: true })

  if (error || !rows) return failure(error, 'Impossible de changer l\'ordre')

  const index = rows.findIndex((row) => row.id === id)
  const neighbor = rows[direction === 'up' ? index - 1 : index + 1]
  const current = rows[index]
  if (!current || !neighbor) return { success: true }

  // Positions réécrites de 0 à n : répare au passage d'éventuels ex aequo
  const reordered = [...rows]
  reordered[index] = neighbor
  reordered[direction === 'up' ? index - 1 : index + 1] = current

  for (const [position, row] of reordered.entries()) {
    if (row.order === position) continue
    const { error: updateError } = await supabase.from(table).update({ order: position }).eq('id', row.id)
    if (updateError) return failure(updateError, 'Impossible de changer l\'ordre')
  }

  revalidate()
  return { success: true }
}

async function nextOrder(table: OrderedTable, userId: string): Promise<number> {
  const supabase = await createClient()
  const { data } = await supabase
    .from(table)
    .select('order')
    .eq('user_id', userId)
    .order('order', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.order ?? -1) + 1
}

// ---------------------------------------------------------------------
// Étapes du pipeline
// ---------------------------------------------------------------------

export async function createStage(input: StageInput): Promise<ActionResult> {
  try {
    const validated = stageSchema.parse(input)
    const { supabase, userId } = await currentUserId()
    if (!userId) return { success: false, error: 'Vous devez être connecté' }

    const { error } = await supabase.from('pipeline_stages').insert({
      user_id: userId,
      name: validated.name,
      color: validated.color,
      kind: validated.kind,
      order: await nextOrder('pipeline_stages', userId),
    })

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { success: false, error: 'Une étape porte déjà ce nom' }
      return failure(error, 'Impossible d\'ajouter l\'étape')
    }

    revalidate()
    return { success: true }
  } catch (error) {
    return failure(error, 'Impossible d\'ajouter l\'étape')
  }
}

export async function updateStage(stageId: string, input: StageInput): Promise<ActionResult> {
  try {
    const validated = stageSchema.parse(input)
    const { supabase, userId } = await currentUserId()
    if (!userId) return { success: false, error: 'Vous devez être connecté' }

    const { data: stage } = await supabase
      .from('pipeline_stages')
      .select('is_default')
      .eq('id', stageId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!stage) return { success: false, error: 'Étape introuvable' }

    // Les nouvelles entreprises arrivent dans l'étape par défaut : elle doit rester « en cours »
    if (stage.is_default && validated.kind !== 'open') {
      return {
        success: false,
        error: 'L\'étape par défaut doit rester « En cours ». Choisissez d\'abord une autre étape par défaut.',
      }
    }

    const { error } = await supabase
      .from('pipeline_stages')
      .update({ name: validated.name, color: validated.color, kind: validated.kind })
      .eq('id', stageId)
      .eq('user_id', userId)

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { success: false, error: 'Une étape porte déjà ce nom' }
      return failure(error, 'Impossible de modifier l\'étape')
    }

    revalidate()
    return { success: true }
  } catch (error) {
    return failure(error, 'Impossible de modifier l\'étape')
  }
}

/**
 * Supprime une étape. Les entreprises qui y étaient passent « Sans étape »
 * (la base met stage_id à NULL) : elles ne sont pas supprimées.
 */
export async function deleteStage(stageId: string): Promise<ActionResult> {
  const { supabase, userId } = await currentUserId()
  if (!userId) return { success: false, error: 'Vous devez être connecté' }

  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('is_default')
    .eq('id', stageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!stage) return { success: false, error: 'Étape introuvable' }
  if (stage.is_default) {
    return { success: false, error: 'Choisissez d\'abord une autre étape par défaut' }
  }

  const { error } = await supabase.from('pipeline_stages').delete().eq('id', stageId).eq('user_id', userId)
  if (error) return failure(error, 'Impossible de supprimer l\'étape')

  revalidate()
  return { success: true }
}

export async function moveStage(stageId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return move('pipeline_stages', stageId, direction)
}

/**
 * Étape où arrivent les nouvelles entreprises (ajoutées à la main ou par Sophie).
 * La base n'accepte qu'une étape par défaut : on retire l'ancienne avant de poser la nouvelle.
 */
export async function setDefaultStage(stageId: string): Promise<ActionResult> {
  const { supabase, userId } = await currentUserId()
  if (!userId) return { success: false, error: 'Vous devez être connecté' }

  const { data: stage } = await supabase
    .from('pipeline_stages')
    .select('kind, is_default')
    .eq('id', stageId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!stage) return { success: false, error: 'Étape introuvable' }
  if (stage.is_default) return { success: true }
  if (stage.kind !== 'open') {
    return { success: false, error: 'Seule une étape « En cours » peut accueillir les nouvelles entreprises' }
  }

  const { data: previous } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()

  if (previous) {
    const { error } = await supabase.from('pipeline_stages').update({ is_default: false }).eq('id', previous.id)
    if (error) return failure(error, 'Impossible de changer l\'étape par défaut')
  }

  const { error } = await supabase.from('pipeline_stages').update({ is_default: true }).eq('id', stageId)
  if (error) {
    // On remet l'ancienne pour ne pas laisser l'utilisateur sans étape par défaut
    if (previous) await supabase.from('pipeline_stages').update({ is_default: true }).eq('id', previous.id)
    return failure(error, 'Impossible de changer l\'étape par défaut')
  }

  revalidate()
  return { success: true }
}

// ---------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------

export async function createSource(input: SourceInput): Promise<ActionResult> {
  try {
    const validated = sourceSchema.parse(input)
    const { supabase, userId } = await currentUserId()
    if (!userId) return { success: false, error: 'Vous devez être connecté' }

    const { error } = await supabase.from('lead_sources').insert({
      user_id: userId,
      name: validated.name,
      order: await nextOrder('lead_sources', userId),
    })

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { success: false, error: 'Une source porte déjà ce nom' }
      return failure(error, 'Impossible d\'ajouter la source')
    }

    revalidate()
    return { success: true }
  } catch (error) {
    return failure(error, 'Impossible d\'ajouter la source')
  }
}

async function isAutomaticSource(sourceId: string, userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('lead_sources')
    .select('name')
    .eq('id', sourceId)
    .eq('user_id', userId)
    .maybeSingle()
  return { exists: !!data, automatic: data?.name === AUTOMATIC_SOURCE_NAME }
}

export async function updateSource(sourceId: string, input: SourceInput): Promise<ActionResult> {
  try {
    const validated = sourceSchema.parse(input)
    const { supabase, userId } = await currentUserId()
    if (!userId) return { success: false, error: 'Vous devez être connecté' }

    const source = await isAutomaticSource(sourceId, userId)
    if (!source.exists) return { success: false, error: 'Source introuvable' }
    if (source.automatic) {
      return { success: false, error: 'Sophie utilise cette source pour ce qu\'elle trouve : elle ne peut pas être renommée' }
    }

    const { error } = await supabase
      .from('lead_sources')
      .update({ name: validated.name })
      .eq('id', sourceId)
      .eq('user_id', userId)

    if (error) {
      if (error.code === UNIQUE_VIOLATION) return { success: false, error: 'Une source porte déjà ce nom' }
      return failure(error, 'Impossible de modifier la source')
    }

    revalidate()
    return { success: true }
  } catch (error) {
    return failure(error, 'Impossible de modifier la source')
  }
}

/**
 * Supprime une source. Les entreprises gardent leur fiche, sans source.
 */
export async function deleteSource(sourceId: string): Promise<ActionResult> {
  const { supabase, userId } = await currentUserId()
  if (!userId) return { success: false, error: 'Vous devez être connecté' }

  const source = await isAutomaticSource(sourceId, userId)
  if (!source.exists) return { success: false, error: 'Source introuvable' }
  if (source.automatic) {
    return { success: false, error: 'Sophie utilise cette source pour ce qu\'elle trouve : elle ne peut pas être supprimée' }
  }

  const { error } = await supabase.from('lead_sources').delete().eq('id', sourceId).eq('user_id', userId)
  if (error) return failure(error, 'Impossible de supprimer la source')

  revalidate()
  return { success: true }
}

export async function moveSource(sourceId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  return move('lead_sources', sourceId, direction)
}
