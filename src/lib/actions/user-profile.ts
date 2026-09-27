'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  onboardingSchema,
  updateProfileSchema,
  type OnboardingInput,
  type UpdateProfileInput,
} from '@/lib/validations/user-profile'

/**
 * Type de retour pour les actions de profil
 */
type ActionResult = {
  success: boolean
  error?: string
}

/**
 * Compléter l'onboarding d'un utilisateur
 */
export async function completeOnboarding(data: OnboardingInput): Promise<ActionResult> {
  try {
    // Validation
    const validated = onboardingSchema.parse(data)

    const supabase = await createClient()

    // Récupérer l'utilisateur connecté
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Vous devez être connecté pour compléter l\'onboarding',
      }
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('onboarding_completed')
      .eq('id', user.id)
      .single()

    const isFirstOnboarding = !profile?.onboarding_completed

    // 1. Profil et métier. Le métier doit être enregistré avant l'initialisation :
    //    le premier ICP est copié depuis ses critères par défaut.
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        first_name: validated.firstName,
        business_name: validated.businessName,
        profession_key: validated.professionKey,
        selected_theme: validated.selectedTheme,
      })
      .eq('id', user.id)

    if (updateError) {
      return {
        success: false,
        error: 'Impossible de sauvegarder votre profil',
      }
    }

    // 2. Espace de prospection : étapes du pipeline, sources, premier ICP (idempotente)
    const { error: initError } = await supabase.rpc('initialize_prospection_defaults')

    if (initError) {
      console.error('Error initializing prospection defaults:', initError)
      return {
        success: false,
        error: 'Impossible de préparer votre espace de prospection, réessayez',
      }
    }

    // 3. Onboarding terminé seulement une fois tout initialisé
    if (isFirstOnboarding) {
      const { error: completeError } = await supabase
        .from('user_profiles')
        .update({ onboarding_completed: true })
        .eq('id', user.id)

      if (completeError) {
        return {
          success: false,
          error: 'Impossible de sauvegarder votre profil',
        }
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de l\'onboarding',
    }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/**
 * Mettre à jour le profil utilisateur
 */
export async function updateProfile(data: UpdateProfileInput): Promise<ActionResult> {
  try {
    // Validation
    const validated = updateProfileSchema.parse(data)

    const supabase = await createClient()

    // Récupérer l'utilisateur connecté
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        success: false,
        error: 'Vous devez être connecté pour mettre à jour votre profil',
      }
    }

    // Mapper les champs camelCase vers snake_case
    const updateData: Record<string, unknown> = {}
    if (validated.firstName !== undefined) {
      updateData.first_name = validated.firstName
    }
    if (validated.businessName !== undefined) {
      updateData.business_name = validated.businessName
    }
    if (validated.selectedTheme !== undefined) {
      updateData.selected_theme = validated.selectedTheme
    }
    if (validated.avatarUrl !== undefined) {
      updateData.avatar_url = validated.avatarUrl
    }

    // Mettre à jour le profil
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update(updateData as never)
      .eq('id', user.id)

    if (updateError) {
      return {
        success: false,
        error: 'Impossible de mettre à jour votre profil',
      }
    }

    revalidatePath('/', 'layout')
    revalidatePath('/settings/profile')

    return {
      success: true,
    }
  } catch (error) {
    return {
      success: false,
      error: 'Une erreur est survenue lors de la mise à jour',
    }
  }
}
