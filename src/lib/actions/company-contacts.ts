'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  companyContactSchema,
  normalizeLinkedinProfileUrl,
  type CompanyContactInput,
} from '@/lib/validations/company'
import { getAuthUser } from '@/lib/supabase/auth'
import { INVALID_PHONE_MESSAGE, toE164 } from '@/lib/phone'

type ActionResult = {
  success: boolean
  error?: string
  // Champ en cause, pour afficher l'erreur sous ce champ du formulaire
  field?: 'phone'
}

const UNIQUE_VIOLATION = '23505'

type Supabase = Awaited<ReturnType<typeof createClient>>

/**
 * Téléphone au format E.164, lu selon le pays de l'entreprise (« 0470 12 34 56 » est belge pour une
 * entreprise belge). undefined : numéro invalide, à signaler sous le champ.
 */
async function normalizedPhone(supabase: Supabase, companyId: string, phone: string | null): Promise<string | null | undefined> {
  if (!phone) return null
  const { data: company } = await supabase.from('companies').select('country').eq('id', companyId).maybeSingle()
  return toE164(phone, company?.country ?? 'FR') ?? undefined
}

function toRow(validated: ReturnType<typeof companyContactSchema.parse>, phone: string | null) {
  return {
    first_name: validated.firstName,
    last_name: validated.lastName,
    role: validated.role,
    is_decision_maker: validated.isDecisionMaker,
    email: validated.email,
    // La source de l'e-mail n'a de sens que s'il y a un e-mail
    email_source: validated.email ? (validated.emailSource ?? 'manual') : null,
    email_confidence: validated.email ? (validated.emailConfidence ?? null) : null,
    phone,
    // Profil LinkedIn remis au format standard (celui qu'attend Waalaxy)
    linkedin_url: normalizeLinkedinProfileUrl(validated.linkedinUrl) ?? validated.linkedinUrl,
    notes: validated.notes,
  }
}

function errorResult(error: unknown, fallback: string): ActionResult {
  if (error instanceof ZodError) {
    return { success: false, error: error.issues[0]?.message ?? 'Données invalides' }
  }
  console.error(fallback, error)
  return { success: false, error: fallback }
}

export async function createCompanyContact(input: CompanyContactInput): Promise<ActionResult> {
  try {
    const validated = companyContactSchema.parse(input)
    const supabase = await createClient()

    const user = await getAuthUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const phone = await normalizedPhone(supabase, validated.companyId, validated.phone)
    if (phone === undefined) return { success: false, error: INVALID_PHONE_MESSAGE, field: 'phone' }

    // data_source et collected_at (RGPD : d'où vient la donnée, et quand)
    // sont renseignés par les valeurs par défaut de la base
    const { error } = await supabase.from('company_contacts').insert({
      ...toRow(validated, phone),
      user_id: user.id,
      company_id: validated.companyId,
      data_source: validated.emailSource === 'hunter' ? 'hunter' : 'manual',
    })

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { success: false, error: 'Un contact avec cet e-mail existe déjà' }
      }
      return errorResult(error, 'Impossible d\'ajouter le contact')
    }

    revalidatePath(`/companies/${validated.companyId}`)
    return { success: true }
  } catch (error) {
    return errorResult(error, 'Impossible d\'ajouter le contact')
  }
}

export async function updateCompanyContact(
  contactId: string,
  input: CompanyContactInput
): Promise<ActionResult> {
  try {
    const validated = companyContactSchema.parse(input)
    const supabase = await createClient()

    const phone = await normalizedPhone(supabase, validated.companyId, validated.phone)
    if (phone === undefined) return { success: false, error: INVALID_PHONE_MESSAGE, field: 'phone' }

    const { error } = await supabase
      .from('company_contacts')
      .update(toRow(validated, phone))
      .eq('id', contactId)
      .eq('company_id', validated.companyId)

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { success: false, error: 'Un contact avec cet e-mail existe déjà' }
      }
      return errorResult(error, 'Impossible de modifier le contact')
    }

    revalidatePath(`/companies/${validated.companyId}`)
    return { success: true }
  } catch (error) {
    return errorResult(error, 'Impossible de modifier le contact')
  }
}

/**
 * Enregistre (ou annule) l'opposition du contact à être prospecté.
 * On garde la date plutôt qu'un simple booléen : c'est la preuve à conserver pour le RGPD.
 */
export async function setCompanyContactOptOut(
  contactId: string,
  companyId: string,
  optedOut: boolean
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('company_contacts')
      .update({ opted_out_at: optedOut ? new Date().toISOString() : null })
      .eq('id', contactId)
      .eq('company_id', companyId)

    if (error) {
      return errorResult(error, 'Impossible de mettre à jour le contact')
    }

    revalidatePath(`/companies/${companyId}`)
    return { success: true }
  } catch (error) {
    return errorResult(error, 'Impossible de mettre à jour le contact')
  }
}

export async function deleteCompanyContact(
  contactId: string,
  companyId: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('company_contacts')
      .delete()
      .eq('id', contactId)
      .eq('company_id', companyId)

    if (error) {
      return errorResult(error, 'Impossible de supprimer le contact')
    }

    revalidatePath(`/companies/${companyId}`)
    return { success: true }
  } catch (error) {
    return errorResult(error, 'Impossible de supprimer le contact')
  }
}

/**
 * Enregistre l'adresse du profil LinkedIn d'un contact (collée depuis LinkedIn),
 * sans passer par le formulaire complet
 */
export async function setCompanyContactLinkedin(
  contactId: string,
  companyId: string,
  url: string
): Promise<ActionResult> {
  const linkedinUrl = normalizeLinkedinProfileUrl(url)
  if (!linkedinUrl) {
    return {
      success: false,
      error: 'Collez l\'adresse d\'un profil LinkedIn, du type linkedin.com/in/prenom-nom',
    }
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('company_contacts')
      .update({ linkedin_url: linkedinUrl })
      .eq('id', contactId)
      .eq('company_id', companyId)

    if (error) return errorResult(error, 'Impossible d\'enregistrer le profil LinkedIn')

    revalidatePath(`/companies/${companyId}`)
    return { success: true }
  } catch (error) {
    return errorResult(error, 'Impossible d\'enregistrer le profil LinkedIn')
  }
}
