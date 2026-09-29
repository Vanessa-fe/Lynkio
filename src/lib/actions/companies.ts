'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { StackDetectionError, analyzeSite } from '@/lib/detectors/stack'
import { findSirenOnSite } from '@/lib/detectors/legal-id'
import { fetchRegistryRecord } from '@/lib/registry'
import {
  createCompanySchema,
  updateCompanySchema,
  toWebsiteDomain,
  type CreateCompanyInput,
  type UpdateCompanyInput,
} from '@/lib/validations/company'
import type { Database } from '@/types/database'

type CompanyUpdate = Database['public']['Tables']['companies']['Update']

type ActionResult<T = void> = {
  success: boolean
  error?: string
  data?: T
}

// Code Postgres d'une violation de contrainte d'unicité
const UNIQUE_VIOLATION = '23505'

function validationMessage(error: unknown): string | null {
  if (error instanceof ZodError) {
    return error.errors[0]?.message ?? 'Données invalides'
  }
  return null
}

/**
 * Cherche une entreprise existante avec le même site ou le même SIREN.
 * La base refuse de toute façon le doublon (index uniques) : cette vérification
 * sert uniquement à afficher un message qui nomme l'entreprise concernée.
 */
async function findDuplicate(
  userId: string,
  website: string | null | undefined,
  registrationId: string | null | undefined,
  excludeId?: string
): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient()
  const domain = toWebsiteDomain(website)

  // Deux requêtes simples plutôt qu'un filtre .or() construit à partir de la saisie
  const lookups = [
    domain ? (['website_domain', domain] as const) : null,
    registrationId ? (['registration_id', registrationId] as const) : null,
  ]

  for (const lookup of lookups) {
    if (!lookup) continue

    let query = supabase
      .from('companies')
      .select('id, name')
      .eq('user_id', userId)
      .eq(lookup[0], lookup[1])

    if (excludeId) {
      query = query.neq('id', excludeId)
    }

    const { data } = await query.limit(1).maybeSingle()
    if (data) return data
  }

  return null
}

export async function createCompany(
  input: CreateCompanyInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const validated = createCompanySchema.parse(input)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour ajouter une entreprise' }
    }

    const duplicate = await findDuplicate(user.id, validated.website, validated.registrationId)
    if (duplicate) {
      return {
        success: false,
        error: `Cette entreprise existe déjà : ${duplicate.name}`,
        data: { id: duplicate.id },
      }
    }

    // Sans étape choisie, l'entreprise arrive dans l'étape par défaut (« À qualifier »)
    let stageId = validated.stageId ?? null
    if (!stageId) {
      const { data: defaultStage } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle()
      stageId = defaultStage?.id ?? null
    }

    const hasStack = !!validated.detectedStack?.length

    const { data, error } = await supabase
      .from('companies')
      .insert({
        user_id: user.id,
        origin: 'manual',
        name: validated.name,
        website: validated.website,
        registration_id: validated.registrationId,
        sector: validated.sector,
        size_category: validated.sizeCategory ?? null,
        city: validated.city,
        postal_code: validated.postalCode,
        stage_id: stageId,
        source_id: validated.sourceId ?? null,
        notes: validated.notes,
        detected_stack: validated.detectedStack ?? [],
        stack_detected_at: hasStack ? new Date().toISOString() : null,
      })
      .select('id')
      .single()

    if (error || !data) {
      if (error?.code === UNIQUE_VIOLATION) {
        return { success: false, error: 'Une entreprise avec ce site ou ce SIREN existe déjà' }
      }
      console.error('Create company error:', error)
      return { success: false, error: 'Impossible d\'ajouter l\'entreprise' }
    }

    revalidatePath('/companies')
    return { success: true, data: { id: data.id } }
  } catch (error) {
    const message = validationMessage(error)
    if (!message) console.error('Create company error:', error)
    return { success: false, error: message ?? 'Une erreur est survenue lors de l\'ajout' }
  }
}

export async function updateCompany(
  companyId: string,
  input: UpdateCompanyInput
): Promise<ActionResult> {
  try {
    const validated = updateCompanySchema.parse(input)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour modifier une entreprise' }
    }

    const duplicate = await findDuplicate(
      user.id,
      validated.website,
      validated.registrationId,
      companyId
    )
    if (duplicate) {
      return { success: false, error: `Cette entreprise existe déjà : ${duplicate.name}` }
    }

    const update: CompanyUpdate = {}
    if (validated.name !== undefined) update.name = validated.name
    if (validated.website !== undefined) update.website = validated.website
    if (validated.registrationId !== undefined) update.registration_id = validated.registrationId
    if (validated.sector !== undefined) update.sector = validated.sector
    if (validated.sizeCategory !== undefined) update.size_category = validated.sizeCategory
    if (validated.city !== undefined) update.city = validated.city
    if (validated.postalCode !== undefined) update.postal_code = validated.postalCode
    if (validated.stageId !== undefined) update.stage_id = validated.stageId
    if (validated.sourceId !== undefined) update.source_id = validated.sourceId
    if (validated.notes !== undefined) update.notes = validated.notes
    if (validated.detectedStack !== undefined) {
      update.detected_stack = validated.detectedStack
      update.stack_detected_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('companies')
      .update(update)
      .eq('id', companyId)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { success: false, error: 'Une entreprise avec ce site ou ce SIREN existe déjà' }
      }
      console.error('Update company error:', error)
      return { success: false, error: 'Impossible de mettre à jour l\'entreprise' }
    }

    if (!data) {
      return { success: false, error: 'Entreprise introuvable' }
    }

    revalidatePath('/companies')
    revalidatePath(`/companies/${companyId}`)
    return { success: true }
  } catch (error) {
    const message = validationMessage(error)
    if (!message) console.error('Update company error:', error)
    return { success: false, error: message ?? 'Une erreur est survenue lors de la mise à jour' }
  }
}

/**
 * Change l'étape du pipeline (liste et fiche)
 */
export async function updateCompanyStage(
  companyId: string,
  stageId: string | null
): Promise<ActionResult> {
  return updateCompany(companyId, { stageId })
}

/**
 * Supprime l'entreprise ; contacts, signaux, qualifications, échanges et relances
 * associés sont supprimés en cascade par la base
 */
export async function deleteCompany(companyId: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour supprimer une entreprise' }
    }

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Delete company error:', error)
      return { success: false, error: 'Impossible de supprimer l\'entreprise' }
    }

    revalidatePath('/companies')
    return { success: true }
  } catch (error) {
    console.error('Delete company error:', error)
    return { success: false, error: 'Une erreur est survenue lors de la suppression' }
  }
}

/**
 * Analyse le site d'une entreprise déjà enregistrée et garde le résultat.
 * La base ajoute ou retire alors le signal « Stack technique compatible »
 * (trigger sync_tech_stack_on_company_change) et recalcule le score.
 */
/**
 * Analyse le site de l'entreprise : technologies utilisées, et SIREN lu dans ses
 * mentions légales. Avec le SIREN, la fiche officielle complète ce qui manque
 * (taille, secteur, ancienneté, chiffre d'affaires, dirigeants) sans écraser
 * ce que l'utilisatrice a saisi.
 */
export async function analyzeCompanyWebsite(
  companyId: string
): Promise<ActionResult<{ detected: string[]; siren: string | null; completed: string[] }>> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const { data: company } = await supabase
      .from('companies')
      .select('website, registration_id, sector, naf_code, headcount_code, size_category, founded_on, city, postal_code')
      .eq('id', companyId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return { success: false, error: 'Entreprise introuvable' }
    if (!company.website) return { success: false, error: 'Renseignez d\'abord le site web de l\'entreprise' }

    const site = await analyzeSite(company.website)
    const update: CompanyUpdate = { detected_stack: site.detected, stack_detected_at: site.checkedAt }
    const completed: string[] = []

    // SIREN : celui de la fiche, sinon celui des mentions légales du site
    const siren = company.registration_id ?? (await findSirenOnSite(site.url, site.html))
    const registry = siren ? await fetchRegistryRecord(siren) : null

    if (registry && !registry.isNonDiffusible) {
      if (!company.registration_id) {
        update.registration_id = registry.siren
        completed.push('SIREN')
      }
      if (!company.sector && registry.sector) update.sector = registry.sector
      if (!company.naf_code && registry.nafCode) update.naf_code = registry.nafCode
      if (!company.headcount_code && registry.headcountCode) update.headcount_code = registry.headcountCode
      if (!company.size_category && registry.sizeCategory) {
        update.size_category = registry.sizeCategory
        completed.push('taille')
      }
      if (!company.founded_on && registry.foundedOn) {
        update.founded_on = registry.foundedOn
        completed.push('date de création')
      }
      if (!company.city && registry.city) update.city = registry.city
      if (!company.postal_code && registry.postalCode) update.postal_code = registry.postalCode
      // Les chiffres publiés sont toujours mis à jour : ce sont ceux du dernier exercice
      if (registry.finances) {
        update.revenue = registry.finances.revenue
        update.net_income = registry.finances.netIncome != null ? Math.round(registry.finances.netIncome) : null
        update.finances_year = registry.finances.year
        completed.push('chiffre d\'affaires')
      }
    }

    const { error } = await supabase.from('companies').update(update).eq('id', companyId).eq('user_id', user.id)

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return { success: false, error: 'Le SIREN trouvé sur ce site est déjà celui d\'une autre de vos entreprises' }
      }
      console.error('Analyze company website error:', error)
      return { success: false, error: 'Impossible d\'enregistrer l\'analyse' }
    }

    // Dirigeants ajoutés comme contacts, seulement si la fiche n'a encore aucun contact
    if (registry && !registry.isNonDiffusible && registry.directors.length > 0) {
      const { count } = await supabase
        .from('company_contacts')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('user_id', user.id)

      if (count === 0) {
        const { error: contactsError } = await supabase.from('company_contacts').insert(
          registry.directors.map((director) => ({
            user_id: user.id,
            company_id: companyId,
            first_name: director.firstName,
            last_name: director.lastName,
            role: director.role,
            is_decision_maker: true,
            data_source: 'recherche-entreprises',
          }))
        )
        if (contactsError) console.error('Analyze company directors error:', contactsError)
        else completed.push('dirigeants')
      }
    }

    revalidatePath(`/companies/${companyId}`)
    revalidatePath('/companies')
    return { success: true, data: { detected: site.detected, siren: registry?.siren ?? null, completed } }
  } catch (error) {
    if (error instanceof StackDetectionError) {
      return { success: false, error: error.message }
    }
    console.error('Analyze company website error:', error)
    return { success: false, error: 'Impossible d\'analyser le site' }
  }
}
