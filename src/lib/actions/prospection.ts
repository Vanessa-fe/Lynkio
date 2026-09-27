'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  prospectionSettingsSchema,
  type ProspectionSettingsInput,
} from '@/lib/validations/prospection'
import { createCompany } from '@/lib/actions/companies'

type ActionResult = {
  success: boolean
  error?: string
}

/**
 * Enregistre le planning et les critères. La prochaine date de passage est
 * recalculée par la base (trigger), pas par l'application.
 */
export async function saveProspectionSettings(input: ProspectionSettingsInput): Promise<ActionResult> {
  try {
    const validated = prospectionSettingsSchema.parse(input)
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const { error } = await supabase.from('prospection_settings').upsert({
      user_id: user.id,
      is_active: validated.isActive,
      days_of_week: validated.daysOfWeek,
      run_hour: validated.runHour,
      departments: validated.departments,
      excluded_naf_sections: validated.excludedNafSections,
      max_companies_per_run: validated.maxCompaniesPerRun,
      sources: validated.sources,
    })

    if (error) {
      console.error('Save prospection settings error:', error)
      return { success: false, error: 'Impossible d\'enregistrer les réglages' }
    }

    revalidatePath('/prospection')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Réglages invalides' }
    }
    console.error('Save prospection settings error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Lance un passage tout de suite. La fonction Supabase répond dès que le passage
 * est créé et continue en arrière-plan : la page suit ensuite son avancement.
 */
export async function launchProspection(): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const { error } = await supabase.functions.invoke('prospection-run', {
      body: { mode: 'manual' },
    })

    if (error) {
      // Message métier renvoyé par la fonction (« déjà en cours », etc.)
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null)
        if (body?.error) {
          return { success: false, error: body.error }
        }
      }
      console.error('Launch prospection error:', error)
      return { success: false, error: 'Impossible de lancer la prospection' }
    }

    revalidatePath('/prospection')
    return { success: true }
  } catch (error) {
    console.error('Launch prospection error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * L'offre ne mène à rien d'utile : elle disparaît de la liste
 */
export async function dismissUnidentifiedOffer(offerId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('unidentified_job_offers')
    .update({ status: 'dismissed' })
    .eq('id', offerId)

  if (error) {
    console.error('Dismiss unidentified offer error:', error)
    return { success: false, error: 'Impossible d\'ignorer cette offre' }
  }

  revalidatePath('/prospection')
  return { success: true }
}

/**
 * Rattache une offre anonyme à une entreprise (existante, ou créée à partir de son nom) :
 * l'offre devient un signal sur la fiche de l'entreprise, comme si Sophie l'avait identifiée.
 */
export async function linkUnidentifiedOffer(
  offerId: string,
  target: { companyId: string } | { newCompany: { name: string; city?: string | null; website?: string | null } }
): Promise<ActionResult & { companyId?: string }> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const { data: offer } = await supabase
      .from('unidentified_job_offers')
      .select('*')
      .eq('id', offerId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!offer) {
      return { success: false, error: 'Offre introuvable' }
    }

    let companyId: string
    if ('companyId' in target) {
      companyId = target.companyId
    } else {
      // La fiche garde la trace de l'offre qui a permis d'identifier l'entreprise
      const created = await createCompany({
        name: target.newCompany.name,
        city: target.newCompany.city,
        website: target.newCompany.website,
        notes: `Identifiée à partir de l'offre « ${offer.title} »${offer.url ? ` : ${offer.url}` : ''}`,
      })
      if (!created.success || !created.data) {
        // Entreprise déjà suivie sous ce site ou ce SIREN : on la réutilise
        if (created.data?.id) {
          companyId = created.data.id
        } else {
          return { success: false, error: created.error || 'Impossible de créer l\'entreprise' }
        }
      } else {
        companyId = created.data.id
      }
    }

    const { error: signalError } = await supabase.from('company_signals').insert({
      user_id: user.id,
      company_id: companyId,
      signal_type: offer.signal_type,
      dedupe_key: `francetravail:${offer.external_id}`,
      source_url: offer.url,
      evidence: {
        source: 'france_travail',
        offre_id: offer.external_id,
        intitule: offer.title,
        type_contrat: offer.contract_type,
        lieu: offer.location,
        date_publication: offer.published_at,
        identifiee_manuellement: true,
      },
    })

    // Signal déjà présent (offre rattachée deux fois) : sans conséquence
    if (signalError && signalError.code !== '23505') {
      console.error('Link unidentified offer signal error:', signalError)
      return { success: false, error: 'Impossible d\'ajouter l\'offre à l\'entreprise' }
    }

    const { error: updateError } = await supabase
      .from('unidentified_job_offers')
      .update({ status: 'linked', company_id: companyId })
      .eq('id', offerId)

    if (updateError) {
      console.error('Link unidentified offer error:', updateError)
      return { success: false, error: 'Impossible de rattacher l\'offre' }
    }

    revalidatePath('/prospection')
    revalidatePath(`/companies/${companyId}`)
    return { success: true, companyId }
  } catch (error) {
    console.error('Link unidentified offer error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
