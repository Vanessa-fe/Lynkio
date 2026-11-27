'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'
import { linkedinPaceSchema, type LinkedinPaceInput } from '@/lib/validations/linkedin'
import { rememberWrittenMessage } from '@/lib/style-memory'
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
// Une sélection dans Personnes : 200 au plus (deux semaines d'invitations au rythme maximum de LinkedIn)
const MAX_SELECTION = 200
// Démarrage en douceur (plafonds du jour divisés par 2) : 14 jours, après une première activation
// ou plus de 30 jours sans envoi automatique
const DAY_MS = 24 * 60 * 60 * 1000
const RAMP_UP_DAYS = 14
const RAMP_UP_AFTER_IDLE_DAYS = 30

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
  // Personnes demandées qui sont maintenant dans la file : ajoutées à l'instant, ou déjà en cours
  // (mises en avant sur la page d'envoi)
  contactIds: string[]
  skipped: { noLinkedin: number; optedOut: number; closed: number; contacted: number; inProgress: number }
}

function revalidateOutreach() {
  revalidatePath('/people/linkedin')
  revalidatePath('/people')
  revalidatePath('/companies')
  revalidatePath('/dashboard')
}

// Les personnes à envoyer : toute une liste, ou celles cochées dans Personnes
export type StartSource = { listId: string } | { contactIds: string[] }

const CONTACT_FIELDS = 'id, linkedin_url, opted_out_at, company:companies!inner(stage:pipeline_stages(kind))'

type Candidate = {
  id: string
  linkedin_url: string | null
  opted_out_at: string | null
  company: { stage: { kind: string } | null } | null
}

/**
 * Prépare l'envoi LinkedIn des personnes d'une liste ou d'une sélection. Sont écartées : celles
 * sans profil LinkedIn, celles qui ne veulent plus être contactées, celles dont la fiche est close
 * (gagnée, perdue, hors cible), celles déjà contactées et celles déjà en cours d'envoi.
 */
export async function startLinkedinSequences(source: StartSource): Promise<ActionResult<StartSummary>> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    let contacts: Candidate[]
    if ('listId' in source) {
      const { data: members, error: membersError } = await supabase
        .from('prospect_list_members')
        .select(`contact:company_contacts!inner(${CONTACT_FIELDS})`)
        .eq('user_id', user.id)
        .eq('list_id', source.listId)

      if (membersError) {
        console.error('LinkedIn start members error:', membersError)
        return { success: false, error: 'Impossible de lire la liste' }
      }
      if (!members || members.length === 0) return { success: false, error: 'Cette liste est vide' }
      contacts = members.map((member) => member.contact as unknown as Candidate)
    } else {
      const contactIds = [...new Set(source.contactIds)]
      if (contactIds.length === 0) return { success: false, error: 'Sélectionnez au moins une personne' }
      if (contactIds.length > MAX_SELECTION) {
        return { success: false, error: `Au plus ${MAX_SELECTION} personnes à la fois` }
      }
      const { data, error } = await supabase
        .from('company_contacts')
        .select(CONTACT_FIELDS)
        .eq('user_id', user.id)
        .in('id', contactIds)

      if (error) {
        console.error('LinkedIn start contacts error:', error)
        return { success: false, error: 'Impossible de lire ces personnes' }
      }
      if (!data || data.length === 0) return { success: false, error: 'Personnes introuvables' }
      contacts = data as unknown as Candidate[]
    }
    const listId = 'listId' in source ? source.listId : null
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
      contactIds: [],
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
    summary.contactIds = [...toAdd, ...contacts.filter((contact) => inProgress.has(contact.id)).map((contact) => contact.id)]

    captureServerEvent(user.id, 'linkedin_sequences_started', {
      from: listId ? 'list' : 'selection',
      added: summary.added,
      skipped: contacts.length - summary.added,
    })

    revalidatePath('/people/linkedin')
    return { success: true, data: summary }
  } catch (error) {
    console.error('LinkedIn start error:', error)
    captureServerError(error, undefined, { action: 'start_linkedin_sequences' })
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
      .select('status, message')
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

    // Premier message réécrit à la main : exemple de son style (un texte de Sophie est reconnu et ignoré)
    if (update.message) await rememberWrittenMessage(supabase, user.id, 'linkedin_message', update.message, sequence.message)

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
    // Messages enregistrés avant la validation : un texte modifié au dernier moment est un exemple de son style
    const { data: before } = await supabase
      .from('linkedin_sequences')
      .select('id, message')
      .eq('user_id', user.id)
      .in('id', items.map((item) => item.id))
    const previousMessage = new Map((before ?? []).map((row) => [row.id, row.message]))

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
      if (data?.length) {
        await rememberWrittenMessage(supabase, user.id, 'linkedin_message', text, previousMessage.get(item.id) ?? null)
      }
    }

    if (approved === 0) return { success: false, error: 'Aucun message validé : vérifiez qu\'ils ne sont pas vides' }

    captureServerEvent(user.id, 'linkedin_messages_approved', { approved })

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

/**
 * Active ou coupe l'envoi automatique par l'extension. L'activer efface une pause éventuelle, et demande
 * que l'utilisatrice ait accepté le risque de restriction de son compte LinkedIn (case cochée dans la
 * fenêtre d'avertissement) : la date d'acceptation est enregistrée, preuve que l'information a été donnée.
 * Première activation, ou reprise après plus de 30 jours sans envoi automatique : 14 jours de démarrage
 * en douceur (la base les rouvre aussi au premier envoi, voir 00090).
 */
export async function setLinkedinAutomation(enabled: boolean, riskAccepted = false): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    if (enabled && !riskAccepted) {
      return {
        success: false,
        error: 'Cochez d’abord la case qui confirme que vous avez compris le risque pour votre compte LinkedIn',
      }
    }

    const supabase = await createClient()
    const now = Date.now()
    let rampUp: { ramp_up_until: string } | Record<string, never> = {}
    if (enabled) {
      const { data: current } = await supabase
        .from('linkedin_automation')
        .select('last_action_at, ramp_up_until')
        .eq('user_id', user.id)
        .maybeSingle()
      const inProgress = !!current?.ramp_up_until && new Date(current.ramp_up_until).getTime() > now
      const freshStart =
        !current?.last_action_at || now - new Date(current.last_action_at).getTime() > RAMP_UP_AFTER_IDLE_DAYS * DAY_MS
      if (freshStart && !inProgress) rampUp = { ramp_up_until: new Date(now + RAMP_UP_DAYS * DAY_MS).toISOString() }
    }

    const { error } = await supabase
      .from('linkedin_automation')
      .upsert(
        {
          user_id: user.id,
          enabled,
          ...(enabled
            ? {
                paused_reason: null,
                paused_at: null,
                paused_until: null,
                risk_accepted_at: new Date(now).toISOString(),
                ...rampUp,
              }
            : {}),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Set LinkedIn automation error:', error)
      return { success: false, error: 'Impossible de changer l\'envoi automatique' }
    }

    revalidatePath('/people/linkedin')
    return { success: true }
  } catch (error) {
    console.error('Set LinkedIn automation error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Reprend l'envoi automatique après une pause posée par l'extension
 */
export async function resumeLinkedinAutomation(): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('linkedin_automation')
      .update({ paused_reason: null, paused_at: null, paused_until: null })
      .eq('user_id', user.id)

    if (error) {
      console.error('Resume LinkedIn automation error:', error)
      return { success: false, error: 'Impossible de reprendre l\'envoi automatique' }
    }

    revalidatePath('/people/linkedin')
    return { success: true }
  } catch (error) {
    console.error('Resume LinkedIn automation error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Rythme d'envoi sur LinkedIn : invitations et messages par jour au plus (envoi automatique et envois
 * notés en un clic). La limite de 100 invitations sur 7 jours, elle, ne se règle pas.
 */
export async function saveLinkedinPace(input: LinkedinPaceInput): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const parsed = linkedinPaceSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Réglage invalide' }

    const supabase = await createClient()
    const { error } = await supabase.from('linkedin_automation').upsert(
      {
        user_id: user.id,
        daily_invitations_limit: parsed.data.dailyInvitationsLimit,
        daily_messages_limit: parsed.data.dailyMessagesLimit,
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('Save LinkedIn pace error:', error)
      return { success: false, error: 'Impossible d’enregistrer le rythme d’envoi' }
    }

    revalidatePath('/people/linkedin')
    revalidatePath('/settings/extension')
    return { success: true }
  } catch (error) {
    console.error('Save LinkedIn pace error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
