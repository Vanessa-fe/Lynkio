'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerEvent } from '@/lib/posthog-server'
import { createCompanyInteraction } from '@/lib/actions/company-interactions'
import { completeReminder, createReminder } from '@/lib/actions/reminders'
import { startProspecting, updateCompanyStage } from '@/lib/actions/companies'
import { launchProspection, launchStrategy } from '@/lib/actions/prospection'

/**
 * Confirmation des actions proposées par Sophie (phase 4 de la refonte).
 *
 * Sophie ne modifie jamais rien seule : la fonction sophie-chat enregistre une PROPOSITION
 * (sophie_actions, statut « proposed ») avec un récapitulatif. Ici, après le clic « Confirmer » :
 *   1. la proposition passe à « confirmed » en une seule requête conditionnelle (statut « proposed »,
 *      moins de 24 heures) : un double clic ou un rejeu n'exécute rien deux fois ;
 *   2. ses arguments sont revérifiés ;
 *   3. l'action passe par les fonctions des écrans (mêmes contrôles, mêmes automatismes) ;
 *   4. le résultat est noté : « executed » ou « failed » avec le message, jamais une fausse réussite.
 */

type DecisionResult = { success: boolean; error?: string; message?: string; runId?: string }

const EXPIRY_MS = 24 * 60 * 60 * 1000
const uuid = z.string().uuid()
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const ARGS = {
  log_activity: z.object({
    companyId: uuid,
    type: z.enum(['email', 'linkedin_message', 'call', 'meeting']),
    direction: z.enum(['incoming', 'outgoing']).nullable(),
    date: isoDay,
    notes: z.string().max(2000).nullable(),
    subject: z.string().max(300),
  }),
  create_reminder: z.object({ companyId: uuid, title: z.string().min(1).max(200), dueDate: isoDay }),
  change_stage: z.object({ companyId: uuid, stageId: uuid, stageName: z.string().max(80) }),
  start_prospecting: z.object({ companyId: uuid }),
  launch_search: z.object({ strategyId: uuid.nullable(), strategyName: z.string().max(80).optional() }),
}

type Kind = keyof typeof ARGS

/** Le jour donné à l'heure dite, heure de Paris (le serveur en ligne tourne en UTC) */
function parisTime(day: string, hour: number): Date {
  const guess = new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`)
  const parisHour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(guess)
  )
  return new Date(guess.getTime() - (parisHour - hour) * 60 * 60 * 1000)
}

export async function decideSophieAction(
  actionId: string,
  decision: 'confirm' | 'refuse',
  options: { completeReminderId?: string | null } = {}
): Promise<DecisionResult> {
  if (!uuid.safeParse(actionId).success) return { success: false, error: 'Action inconnue' }
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }
  const supabase = await createClient()
  const now = new Date()

  if (decision === 'refuse') {
    await supabase
      .from('sophie_actions')
      .update({ status: 'refused', decided_at: now.toISOString() })
      .eq('id', actionId)
      .eq('status', 'proposed')
    captureServerEvent(user.id, 'sophie_action_refused')
    return { success: true, message: 'Action annulée : rien n’a été modifié.' }
  }

  // Passage « proposed » → « confirmed » en une seule fois : un deuxième clic ne trouve plus rien à confirmer
  const { data: action } = await supabase
    .from('sophie_actions')
    .update({ status: 'confirmed', decided_at: now.toISOString() })
    .eq('id', actionId)
    .eq('status', 'proposed')
    .gte('created_at', new Date(now.getTime() - EXPIRY_MS).toISOString())
    .select('id, kind, args, summary')
    .maybeSingle()

  if (!action) {
    const { data: existing } = await supabase.from('sophie_actions').select('status, created_at').eq('id', actionId).maybeSingle()
    if (!existing) return { success: false, error: 'Action inconnue' }
    if (existing.status === 'executed' || existing.status === 'confirmed') return { success: true, message: 'Déjà fait.' }
    if (existing.status === 'refused') return { success: false, error: 'Cette action a été annulée.' }
    if (existing.status === 'failed') return { success: false, error: 'Cette action n’a pas abouti : demandez à Sophie de la reproposer.' }
    return { success: false, error: 'Proposition expirée (plus de 24 heures) : demandez à Sophie de la reproposer.' }
  }

  const finish = async (result: DecisionResult) => {
    await supabase
      .from('sophie_actions')
      .update({
        status: result.success ? 'executed' : 'failed',
        executed_at: new Date().toISOString(),
        result: result.success ? { message: result.message ?? null, runId: result.runId ?? null } : null,
        error: result.success ? null : (result.error ?? 'Erreur').slice(0, 1000),
      })
      .eq('id', actionId)
    captureServerEvent(user.id, result.success ? 'sophie_action_executed' : 'sophie_action_failed', { kind: action.kind })
    revalidatePath('/', 'layout')
    return result
  }

  const kind = action.kind as Kind
  const parsed = ARGS[kind]?.safeParse(action.args)
  if (!parsed?.success) return finish({ success: false, error: 'Proposition illisible : rien n’a été modifié.' })

  try {
    switch (kind) {
      case 'log_activity': {
        const args = parsed.data as z.infer<typeof ARGS.log_activity>
        // Échange du jour : l'heure de confirmation ; un échange passé : midi ce jour-là
        const today = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(now)
        const occurredAt = args.date === today ? now : parisTime(args.date, 12)
        const result = await createCompanyInteraction({
          companyId: args.companyId,
          type: args.type,
          direction: args.direction,
          status: 'done',
          subject: args.subject,
          content: args.notes,
          occurredAt,
        })
        if (!result.success) return finish({ success: false, error: result.error })
        // Relance prévue cochée dans la carte (jamais d'office)
        if (options.completeReminderId && uuid.safeParse(options.completeReminderId).success) {
          await completeReminder(options.completeReminderId)
        }
        return finish({ success: true, message: 'Échange noté.' })
      }
      case 'create_reminder': {
        const args = parsed.data as z.infer<typeof ARGS.create_reminder>
        const result = await createReminder({
          companyId: args.companyId,
          title: args.title,
          dueAt: parisTime(args.dueDate, 9),
          priority: 'medium',
        })
        return finish(result.success ? { success: true, message: 'Relance programmée.' } : { success: false, error: result.error })
      }
      case 'change_stage': {
        const args = parsed.data as z.infer<typeof ARGS.change_stage>
        const result = await updateCompanyStage(args.companyId, args.stageId)
        return finish(result.success ? { success: true, message: `Étape changée : ${args.stageName}.` } : { success: false, error: result.error })
      }
      case 'start_prospecting': {
        const args = parsed.data as z.infer<typeof ARGS.start_prospecting>
        const result = await startProspecting(args.companyId)
        return finish(result.success ? { success: true, message: 'Entreprise ajoutée à votre suivi commercial.' } : { success: false, error: result.error })
      }
      case 'launch_search': {
        const args = parsed.data as z.infer<typeof ARGS.launch_search>
        const result = args.strategyId ? await launchStrategy(args.strategyId) : await launchProspection()
        return finish(
          result.success
            ? { success: true, message: 'Recherche lancée : vous serez prévenu à la fin.', runId: result.runId }
            : { success: false, error: result.error }
        )
      }
    }
  } catch (error) {
    console.error('Sophie action error:', error)
    return finish({ success: false, error: 'Une erreur est survenue : rien n’a été modifié.' })
  }
  return finish({ success: false, error: 'Action non prévue' })
}

/** État d'une action affichée dans une carte (après un rechargement de la conversation) */
export async function getSophieActionStatus(
  actionId: string
): Promise<{ status: string; error: string | null; message: string | null } | null> {
  if (!uuid.safeParse(actionId).success) return null
  const supabase = await createClient()
  const { data } = await supabase.from('sophie_actions').select('status, error, result, created_at').eq('id', actionId).maybeSingle()
  if (!data) return null
  const expired = data.status === 'proposed' && Date.now() - new Date(data.created_at).getTime() > EXPIRY_MS
  return {
    status: expired ? 'expired' : data.status,
    error: data.error,
    message: (data.result as { message?: string } | null)?.message ?? null,
  }
}
