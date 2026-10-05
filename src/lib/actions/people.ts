'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { normalizeLinkedinProfileUrl, personSchema, type PersonInput } from '@/lib/validations/company'
import { findContactByLinkedin } from '@/lib/queries/people'
import { addContactsToList } from '@/lib/actions/prospect-lists'

type ActionResult<T = void> = {
  success: boolean
  error?: string
  data?: T
}

const UNIQUE_VIOLATION = '23505'

type Supabase = Awaited<ReturnType<typeof createClient>>

function errorResult(error: unknown, fallback: string): ActionResult<never> {
  if (error instanceof ZodError) {
    return { success: false, error: error.errors[0]?.message ?? 'Données invalides' }
  }
  console.error(fallback, error)
  return { success: false, error: fallback }
}

async function defaultStageId(supabase: Supabase, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('pipeline_stages')
    .select('id')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Entreprise du même nom (sans tenir compte de la casse), pour ne pas créer de doublon
 * quand on tape le nom d'une entreprise déjà suivie
 */
async function findOrganizationByName(supabase: Supabase, userId: string, name: string) {
  const { data } = await supabase
    .from('companies')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', 'organization')
    .ilike('name', name.replace(/[\\%_]/g, '\\$&'))
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/**
 * Ajoute une personne, seule ou dans une entreprise (existante ou créée ici).
 * Renvoie la fiche où elle se trouve : la sienne, ou celle de son entreprise.
 * Une personne dont le profil LinkedIn est déjà suivi n'est pas ajoutée une seconde fois.
 */
export async function createPerson(input: PersonInput): Promise<ActionResult<{ companyId: string }>> {
  try {
    const validated = personSchema.parse(input)
    const supabase = await createClient()
    const user = await getAuthUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const duplicate = await findContactByLinkedin(supabase, user.id, validated.linkedinUrl)
    if (duplicate) {
      return {
        success: false,
        error: `${duplicate.name} est déjà dans Lynkio`,
        data: { companyId: duplicate.companyId },
      }
    }

    // Venue de LinkedIn : la fiche créée prend la source « LinkedIn », si elle existe
    let sourceId: string | null = null
    if (validated.origin === 'linkedin') {
      const { data: source } = await supabase
        .from('lead_sources')
        .select('id')
        .eq('user_id', user.id)
        .ilike('name', 'linkedin')
        .limit(1)
        .maybeSingle()
      sourceId = source?.id ?? null
    }

    const fullName = [validated.firstName, validated.lastName].filter(Boolean).join(' ')
    const pipeline = {
      stage_id: validated.stageId ?? (await defaultStageId(supabase, user.id)),
      next_action: validated.nextAction,
      estimated_amount: validated.estimatedAmount ?? null,
      source_id: sourceId,
    }

    let companyId: string | null = null
    // Fiche créée ici : supprimée si la personne ne peut pas être enregistrée
    let createdCompanyId: string | null = null

    if (validated.companyMode === 'existing') {
      const { data } = await supabase
        .from('companies')
        .select('id')
        .eq('id', validated.companyId!)
        .eq('user_id', user.id)
        .eq('kind', 'organization')
        .maybeSingle()
      if (!data) return { success: false, error: 'Entreprise introuvable' }
      companyId = data.id
    } else if (validated.companyMode === 'new') {
      companyId = await findOrganizationByName(supabase, user.id, validated.companyName!)
    }

    if (!companyId) {
      const isIndividual = validated.companyMode === 'none'
      const { data, error } = await supabase
        .from('companies')
        .insert({
          user_id: user.id,
          origin: 'manual',
          kind: isIndividual ? 'individual' : 'organization',
          name: isIndividual ? fullName : validated.companyName!,
          size_category: isIndividual && validated.isIndependent ? 'solo' : null,
          ...pipeline,
        })
        .select('id')
        .single()

      if (error || !data) return errorResult(error, 'Impossible de créer la fiche')
      companyId = data.id
      createdCompanyId = data.id
    }

    const { data: contact, error } = await supabase
      .from('company_contacts')
      .insert({
        user_id: user.id,
        company_id: companyId,
        first_name: validated.firstName,
        last_name: validated.lastName,
        role: validated.role,
        // Une personne seule décide pour elle-même
        is_decision_maker: validated.companyMode === 'none' || validated.isDecisionMaker,
        email: validated.email,
        email_source: validated.email ? 'manual' : null,
        phone: validated.phone,
        linkedin_url: normalizeLinkedinProfileUrl(validated.linkedinUrl) ?? validated.linkedinUrl,
        notes: validated.notes,
        // RGPD : d'où vient la donnée
        data_source: validated.origin,
      })
      .select('id')
      .single()

    if (error || !contact) {
      if (createdCompanyId) {
        await supabase.from('companies').delete().eq('id', createdCompanyId).eq('user_id', user.id)
      }
      if (error?.code === UNIQUE_VIOLATION) {
        return { success: false, error: 'Une personne avec cet e-mail existe déjà' }
      }
      return errorResult(error, 'Impossible d\'ajouter la personne')
    }

    // La personne est enregistrée même si le rangement dans la liste échoue
    if (validated.listName) {
      const listed = await addContactsToList({ listName: validated.listName }, [contact.id])
      if (!listed.success) console.error('Create person list error:', listed.error)
    }

    revalidatePath('/people')
    revalidatePath('/companies')
    return { success: true, data: { companyId } }
  } catch (error) {
    return errorResult(error, 'Impossible d\'ajouter la personne')
  }
}

/**
 * Rattache une personne seule à une entreprise déjà suivie, ou à une entreprise
 * créée à partir de son nom. La base déplace contact, échanges, relances et signaux
 * en une seule opération (attach_individual_to_company), puis supprime la fiche de la personne.
 */
export async function attachIndividualToCompany(
  individualId: string,
  target: { companyId: string } | { companyName: string }
): Promise<ActionResult<{ companyId: string }>> {
  try {
    const supabase = await createClient()
    const user = await getAuthUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    let companyId: string | null = 'companyId' in target ? target.companyId : null
    let createdCompanyId: string | null = null

    if ('companyName' in target) {
      const name = target.companyName.trim()
      if (!name) return { success: false, error: 'Indiquez le nom de l\'entreprise' }
      if (name.length > 200) return { success: false, error: 'Le nom de l\'entreprise est trop long' }

      companyId = await findOrganizationByName(supabase, user.id, name)
      if (!companyId) {
        const { data, error } = await supabase
          .from('companies')
          .insert({
            user_id: user.id,
            origin: 'manual',
            kind: 'organization',
            name,
            stage_id: await defaultStageId(supabase, user.id),
          })
          .select('id')
          .single()
        if (error || !data) return errorResult(error, 'Impossible de créer l\'entreprise')
        companyId = data.id
        createdCompanyId = data.id
      }
    }

    const { error } = await supabase.rpc('attach_individual_to_company', {
      p_individual_id: individualId,
      p_company_id: companyId!,
    })

    if (error) {
      if (createdCompanyId) {
        await supabase.from('companies').delete().eq('id', createdCompanyId).eq('user_id', user.id)
      }
      return errorResult(error, 'Impossible de rattacher la personne')
    }

    revalidatePath('/people')
    revalidatePath('/companies')
    revalidatePath(`/companies/${companyId}`)
    return { success: true, data: { companyId: companyId! } }
  } catch (error) {
    return errorResult(error, 'Impossible de rattacher la personne')
  }
}
