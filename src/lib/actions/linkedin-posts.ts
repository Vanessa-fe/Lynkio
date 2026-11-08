'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'
import { createPerson } from '@/lib/actions/people'
import { findContactByLinkedin } from '@/lib/queries/people'
import { findEmail, hunterApiKey, HunterError, linkedinHandle } from '@/lib/hunter'
import {
  linkedinPostSearchSchema,
  splitAuthorName,
  type LinkedinPostSearchInput,
} from '@/lib/validations/linkedin-posts'
import type { EmailSource } from '@/types'

type ActionResult<T = void> = {
  success: boolean
  error?: string
  data?: T
}

const UNIQUE_VIOLATION = '23505'
// Texte du post gardé avec le signal, pour que Sophie s'en serve dans le message
const MAX_SIGNAL_TEXT = 3000

export type AddedPost = {
  companyId: string
  contactId: string
  email: string | null
  emailSource: EmailSource | null
  // Pourquoi l'e-mail n'a pas été cherché ou trouvé, à dire à l'utilisatrice
  emailNote: string | null
}

/**
 * Active ou coupe la recherche de posts par l'extension, et enregistre ses mots-clés
 */
export async function saveLinkedinPostSearch(input: LinkedinPostSearchInput): Promise<ActionResult> {
  try {
    const validated = linkedinPostSearchSchema.parse(input)
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase
      .from('linkedin_automation')
      .upsert(
        { user_id: user.id, post_search_enabled: validated.enabled, post_keywords: validated.keywords },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Save LinkedIn post search error:', error)
      return { success: false, error: 'Impossible d\'enregistrer la recherche de posts' }
    }

    captureServerEvent(user.id, 'linkedin_post_search_saved', {
      enabled: validated.enabled,
      keywords: validated.keywords.length,
    })
    revalidatePath('/settings/extension')
    revalidatePath('/prospection')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Données invalides' }
    }
    console.error('Save LinkedIn post search error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Le post ne mène à rien d'utile : il disparaît de la liste
 */
export async function dismissLinkedinPost(postId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('linkedin_posts')
    .update({ status: 'dismissed' })
    .eq('id', postId)
    .in('status', ['new', 'filtered'])

  if (error) {
    console.error('Dismiss LinkedIn post error:', error)
    return { success: false, error: 'Impossible d\'ignorer ce post' }
  }

  revalidatePath('/prospection')
  return { success: true }
}

/**
 * E-mail de l'auteur avec Hunter : d'après son profil LinkedIn, sinon d'après son nom
 * et son entreprise. Une erreur de Hunter n'empêche pas d'ajouter la personne.
 */
async function emailFromHunter(
  profileUrl: string | null,
  name: { firstName: string | null; lastName: string | null },
  companyName: string | null
): Promise<{ email: string; confidence: number | null } | { email: null; note: string }> {
  const apiKey = hunterApiKey()
  if (!apiKey) return { email: null, note: 'La recherche d\'e-mail (Hunter) n\'est pas configurée' }

  try {
    const handle = linkedinHandle(profileUrl)
    let person = handle ? await findEmail({ linkedinHandle: handle }, apiKey) : null
    if (!person && companyName && name.firstName && name.lastName) {
      person = await findEmail({ company: companyName, firstName: name.firstName, lastName: name.lastName }, apiKey)
    }
    return person
      ? { email: person.email.toLowerCase(), confidence: person.score }
      : { email: null, note: 'Hunter n\'a pas trouvé d\'e-mail pour cette personne' }
  } catch (error) {
    if (error instanceof HunterError) return { email: null, note: error.message }
    console.error('LinkedIn post Hunter error:', error)
    return { email: null, note: 'La recherche d\'e-mail n\'a pas abouti' }
  }
}

/**
 * Ajoute l'auteur du post à Filonea : la personne (avec son profil LinkedIn et, si possible,
 * son e-mail), son entreprise ou sa fiche de personne seule, et le signal « Cherche un
 * freelance sur LinkedIn » avec le texte du post. Déjà dans Filonea : le signal s'ajoute à sa fiche.
 */
export async function addLinkedinPost(postId: string): Promise<ActionResult<AddedPost>> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { data: post } = await supabase
      .from('linkedin_posts')
      .select('*')
      .eq('id', postId)
      .eq('user_id', user.id)
      .in('status', ['new', 'filtered'])
      .maybeSingle()

    if (!post) return { success: false, error: 'Post introuvable ou déjà traité' }

    let companyId: string
    let contactId: string
    let email: string | null = null
    let emailSource: EmailSource | null = null
    let emailNote: string | null = null

    const existing = await findContactByLinkedin(supabase, user.id, post.author_linkedin_url)
    if (existing) {
      companyId = existing.companyId
      contactId = existing.id
      const { data: contact } = await supabase
        .from('company_contacts')
        .select('email, email_source')
        .eq('id', existing.id)
        .maybeSingle()
      email = contact?.email ?? null
      emailSource = contact?.email_source ?? null
    } else {
      const name = splitAuthorName(post.author_name)
      if (post.email) {
        email = post.email
        emailSource = 'linkedin_post'
      }
      let confidence: number | null = null
      if (!email) {
        const found = await emailFromHunter(post.author_linkedin_url, name, post.company_name)
        if ('note' in found) {
          emailNote = found.note
        } else {
          email = found.email
          emailSource = 'hunter'
          confidence = found.confidence
        }
      }

      const created = await createPerson({
        firstName: name.firstName,
        lastName: name.lastName ?? (name.firstName ? null : post.author_name.slice(0, 100)),
        role: post.author_headline?.slice(0, 200) ?? null,
        // Elle cherche un freelance : c'est elle qui décide
        isDecisionMaker: true,
        email,
        emailSource,
        emailConfidence: confidence,
        linkedinUrl: post.author_linkedin_url,
        notes: `Trouvée par Sophie dans un post LinkedIn : ${post.post_url}`,
        companyMode: post.company_name ? 'new' : 'none',
        companyName: post.company_name,
        origin: 'linkedin_post',
      })
      if (!created.success || !created.data?.contactId) {
        return { success: false, error: created.error || 'Impossible d\'ajouter cette personne' }
      }
      companyId = created.data.companyId
      contactId = created.data.contactId
    }

    const { error: signalError } = await supabase.from('company_signals').insert({
      user_id: user.id,
      company_id: companyId,
      signal_type: 'linkedin_post_request',
      dedupe_key: `linkedin:${post.post_urn}`,
      source_url: post.post_url,
      evidence: {
        source: 'linkedin_post',
        post_urn: post.post_urn,
        intitule: post.summary,
        auteur: post.author_name,
        poste_auteur: post.author_headline,
        date_publication: post.posted_at,
        description: post.text.slice(0, MAX_SIGNAL_TEXT),
      },
    })
    // Signal déjà présent (post ajouté deux fois) : sans conséquence
    if (signalError && signalError.code !== UNIQUE_VIOLATION) {
      console.error('Add LinkedIn post signal error:', signalError)
      return { success: false, error: 'La personne est ajoutée, mais pas le post sur sa fiche' }
    }

    const { error: updateError } = await supabase
      .from('linkedin_posts')
      .update({ status: 'added', company_id: companyId, contact_id: contactId })
      .eq('id', post.id)
    if (updateError) console.error('Add LinkedIn post status error:', updateError)

    captureServerEvent(user.id, 'linkedin_post_added', {
      already_known: !!existing,
      was_filtered: post.status === 'filtered',
      email_source: emailSource ?? 'none',
    })
    revalidatePath('/prospection')
    revalidatePath('/people')
    revalidatePath('/companies')
    return { success: true, data: { companyId, contactId, email, emailSource, emailNote } }
  } catch (error) {
    console.error('Add LinkedIn post error:', error)
    captureServerError(error, undefined, { action: 'add_linkedin_post' })
    return { success: false, error: 'Une erreur est survenue' }
  }
}
