'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import {
  prospectionSettingsSchema,
  type ProspectionSettingsInput,
} from '@/lib/validations/prospection'

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
