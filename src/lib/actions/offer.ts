'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { offerSchema, type OfferInput } from '@/lib/validations/offer'
import type { IcpCriteria } from '@/lib/validations/icp'

type ActionResult = { success: boolean; error?: string }

/**
 * Enregistre « Mon offre et mes objectifs » dans le client idéal actif, sans toucher aux autres critères
 */
export async function saveOffer(input: OfferInput): Promise<ActionResult> {
  try {
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }
    const offer = offerSchema.parse(input)

    const supabase = await createClient()
    const { data: icp } = await supabase
      .from('icp_profiles')
      .select('id, criteria')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle()
    if (!icp) return { success: false, error: 'Client idéal introuvable' }

    const criteria: IcpCriteria = {
      ...((icp.criteria ?? {}) as IcpCriteria),
      services: offer.services.map((service) => ({
        name: service.name,
        description: service.description,
        price_from: service.priceFrom,
        unit: service.unit,
      })),
      mission_mode: {
        mode: offer.missionMode,
        max_km: offer.missionMode === 'remote' ? null : offer.maxDistanceKm,
      },
      goals: {
        contacts_per_week: offer.goals.contactsPerWeek,
        clients_per_month: offer.goals.clientsPerMonth,
        revenue_per_month: offer.goals.revenuePerMonth,
      },
    }

    const { error } = await supabase
      .from('icp_profiles')
      .update({ criteria })
      .eq('id', icp.id)
      .eq('user_id', user.id)
    if (error) {
      console.error('saveOffer', error)
      return { success: false, error: 'Impossible d’enregistrer votre offre' }
    }
    revalidatePath('/settings/offer')
    revalidatePath('/dashboard')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) return { success: false, error: error.errors[0]?.message ?? 'Données invalides' }
    console.error('saveOffer', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}
