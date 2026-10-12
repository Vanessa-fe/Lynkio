'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { LinkedinSequenceStatus } from '@/types'

type ActionResult<T = void> = {
  success: boolean
  error?: string
  data?: T
}

const UNIQUE_VIOLATION = '23505'
const MAX_MESSAGE_LENGTH = 2000
const MAX_ANGLE_LENGTH = 500
const MAX_APPROVALS_PER_CALL = 200

// Messages d'erreur de advance_linkedin_sequence, montrés tels quels
const STEP_ERRORS = [
  'Cette étape est déjà passée',
  'Cette personne ne souhaite plus être contactée',
  'Le message est vide',
  'Envoi introuvable',
]

// Chaque texte reste modifiable jusqu'à son envoi
const BEFORE_MESSAGE: LinkedinSequenceStatus[] = ['to_review', 'approved', 'invited', 'connected']
const EDITABLE_STATUSES = {
  message: BEFORE_MESSAGE,
  follow_up_1: [...BEFORE_MESSAGE, 'messaged'],
  follow_up_2: [...BEFORE_MESSAGE, 'messaged', 'followed_up_1'],
} satisfies Record<string, LinkedinSequenceStatus[]>

export type LinkedinStep = 'invited' | 'connected' | 'messaged' | 'followed_up_1' | 'followed_up_2' | 'replied' | 'stopped'

// Textes d'une séquence : le message, puis les deux relances (vides : pas de relance)
export type LinkedinTexts = { message?: string; followUp1?: string; followUp2?: string }

export type StartSummary = {
  added: number
  skipped: { noLinkedin: number; optedOut: number; closed: number; contacted: number; inProgress: number }
}

function revalidateOutreach() {
  revalidatePath('/people/linkedin')
  revalidatePath('/people')
  revalidatePath('/companies')
  revalidatePath('/dashboard')
}

/**
 * Prépare l'envoi LinkedIn des personnes d'une liste. Sont écartées : celles sans profil
 * LinkedIn, celles qui ne veulent plus être contactées, celles dont la fiche est close
 * (gagnée, perdue, hors cible), celles déjà contactées et celles déjà en cours d'envoi.
 */
export async function startLinkedinSequences(listId: string): Promise<ActionResult<StartSummary>> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { data: members, error: membersError } = await supabase
      .from('prospect_list_members')
      .select('contact:company_contacts!inner(id, linkedin_url, opted_out_at, company:companies!inner(stage:pipeline_stages(kind)))')
      .eq('user_id', user.id)
      .eq('list_id', listId)

    if (membersError) {
      console.error('LinkedIn start members error:', membersError)
      return { success: false, error: 'Impossible de lire la liste' }
    }
    if (!members || members.length === 0) return { success: false, error: 'Cette liste est vide' }

    type Member = {
      id: string
      linkedin_url: string | null
      opted_out_at: string | null
      company: { stage: { kind: string } | null } | null
    }
    const contacts = members.map((member) => member.contact as unknown as Member)
    const ids = contacts.map((contact) => contact.id)

    const [outreachResult, activeResult] = await Promise.all([
      supabase.from('contact_outreach').select('contact_id, status').in('contact_id', ids),
      supabase.from('linkedin_sequences').select('contact_id').in('contact_id', ids).neq('status', 'stopped'),
    ])
    if (outreachResult.error || activeResult.error) {
      console.error('LinkedIn start lookup error:', outreachResult.error ?? activeResult.error)
      return { success: false, error: 'Impossible de préparer l\'envoi' }
    }

    const outreach = new Map((outreachResult.data ?? []).map((row) => [row.contact_id, row.status]))
    const inProgress = new Set((activeResult.data ?? []).map((row) => row.contact_id))

    const summary: StartSummary = {
      added: 0,
      skipped: { noLinkedin: 0, optedOut: 0, closed: 0, contacted: 0, inProgress: 0 },
    }
    const toAdd: string[] = []

    for (const contact of contacts) {
      const stageKind = contact.company?.stage?.kind
      if (!contact.linkedin_url) summary.skipped.noLinkedin++
      else if (contact.opted_out_at) summary.skipped.optedOut++
      else if (stageKind && stageKind !== 'open') summary.skipped.closed++
      else if (inProgress.has(contact.id)) summary.skipped.inProgress++
      else if ((outreach.get(contact.id) ?? 'to_contact') !== 'to_contact') summary.skipped.contacted++
      else toAdd.push(contact.id)
    }

    if (toAdd.length > 0) {
      const { error } = await supabase
        .from('linkedin_sequences')
        .insert(toAdd.map((contactId) => ({ user_id: user.id, contact_id: contactId, list_id: listId })))

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          return { success: false, error: 'Certaines personnes viennent d\'être ajoutées à l\'envoi : rechargez la page' }
        }
        console.error('LinkedIn start insert error:', error)
        return { success: false, error: 'Impossible de préparer l\'envoi' }
      }
      summary.added = toAdd.length
    }

    revalidatePath('/people/linkedin')
    return { success: true, data: summary }
  } catch (error) {
    console.error('LinkedIn start error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Enregistre les textes (rédigés par Sophie ou modifiés à la main). Un texte déjà envoyé
 * ne change plus.
 */
export async function saveLinkedinTexts(
  sequenceId: string,
  texts: LinkedinTexts,
  angle?: string | null
): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const fields = {
      message: texts.message,
      follow_up_1: texts.followUp1,
      follow_up_2: texts.followUp2,
    }
    for (const value of Object.values(fields)) {
      if (value !== undefined && value.trim().length > MAX_MESSAGE_LENGTH) {
        return { success: false, error: 'Le message est trop long' }
      }
    }

    const supabase = await createClient()
    const { data: sequence } = await supabase
      .from('linkedin_sequences')
      .select('status')
      .eq('id', sequenceId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!sequence) return { success: false, error: 'Envoi introuvable' }

    const update: Partial<Record<keyof typeof EDITABLE_STATUSES | 'message_angle', string | null>> = {}
    for (const [column, value] of Object.entries(fields) as [keyof typeof EDITABLE_STATUSES, string | undefined][]) {
      if (value === undefined) continue
      if (!(EDITABLE_STATUSES[column] as LinkedinSequenceStatus[]).includes(sequence.status)) {
        return { success: false, error: 'Ce message a déjà été envoyé' }
      }
      update[column] = value.trim() || null
    }
    if (angle !== undefined) update.message_angle = angle?.trim().slice(0, MAX_ANGLE_LENGTH) || null
    if (Object.keys(update).length === 0) return { success: true }

    const { error } = await supabase
      .from('linkedin_sequences')
      .update(update)
      .eq('id', sequenceId)
      .eq('user_id', user.id)
      .eq('status', sequence.status)

    if (error) {
      console.error('Save LinkedIn texts error:', error)
      return { success: false, error: 'Impossible d\'enregistrer le message' }
    }

    revalidatePath('/people/linkedin')
    return { success: true }
  } catch (error) {
    console.error('Save LinkedIn texts error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Valide des séquences relues (le message et ses relances) : les personnes passent « à inviter »
 */
export async function approveLinkedinSequences(
  items: ({ id: string; message: string } & Pick<LinkedinTexts, 'followUp1' | 'followUp2'>)[]
): Promise<ActionResult<{ approved: number }>> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    if (items.length === 0) return { success: false, error: 'Aucun message à valider' }
    if (items.length > MAX_APPROVALS_PER_CALL) {
      return { success: false, error: `Au plus ${MAX_APPROVALS_PER_CALL} messages à la fois` }
    }

    const supabase = await createClient()
    let approved = 0

    for (const item of items) {
      const text = item.message.trim()
      const followUp1 = item.followUp1?.trim() || null
      const followUp2 = item.followUp2?.trim() || null
      if (!text || [text, followUp1, followUp2].some((value) => value && value.length > MAX_MESSAGE_LENGTH)) continue

      const { data, error } = await supabase
        .from('linkedin_sequences')
        .update({ message: text, follow_up_1: followUp1, follow_up_2: followUp2, status: 'approved' })
        .eq('id', item.id)
        .eq('user_id', user.id)
        .eq('status', 'to_review')
        .select('id')

      if (error) {
        console.error('Approve LinkedIn sequence error:', error)
        continue
      }
      approved += data?.length ?? 0
    }

    if (approved === 0) return { success: false, error: 'Aucun message validé : vérifiez qu\'ils ne sont pas vides' }

    revalidatePath('/people/linkedin')
    return { success: true, data: { approved } }
  } catch (error) {
    console.error('Approve LinkedIn sequences error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Retire une personne de l'envoi. Pas encore contactée : elle disparaît de la file ;
 * déjà invitée ou contactée : l'envoi est arrêté et reste dans l'historique.
 */
export async function removeLinkedinSequence(sequenceId: string): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { data: deleted, error } = await supabase
      .from('linkedin_sequences')
      .delete()
      .eq('id', sequenceId)
      .eq('user_id', user.id)
      .in('status', ['to_review', 'approved'])
      .select('id')

    if (error) {
      console.error('Remove LinkedIn sequence error:', error)
      return { success: false, error: 'Impossible de retirer cette personne' }
    }
    if (deleted && deleted.length > 0) {
      revalidatePath('/people/linkedin')
      return { success: true }
    }

    return advanceLinkedinSequence(sequenceId, 'stopped')
  } catch (error) {
    console.error('Remove LinkedIn sequence error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Note une étape franchie (invitation envoyée, acceptée, message ou relance envoyés, réponse, arrêt).
 * La base la note aussi dans les échanges de la personne : statut et étape suivent.
 */
export async function advanceLinkedinSequence(sequenceId: string, step: LinkedinStep): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase.rpc('advance_linkedin_sequence', { p_sequence_id: sequenceId, p_step: step })

    if (error) {
      if (STEP_ERRORS.includes(error.message)) return { success: false, error: error.message }
      console.error('Advance LinkedIn sequence error:', error)
      return { success: false, error: 'Impossible d\'enregistrer cette étape' }
    }

    revalidateOutreach()
    return { success: true }
  } catch (error) {
    console.error('Advance LinkedIn sequence error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
