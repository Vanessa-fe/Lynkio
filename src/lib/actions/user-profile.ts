'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  messageSettingsSchema,
  onboardingSchema,
  updateProfileSchema,
  type MessageSettingsInput,
  type OnboardingInput,
  type UpdateProfileInput,
} from '@/lib/validations/user-profile'
import { getAuthUser } from '@/lib/supabase/auth'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'
import { syncBrevoContact } from '@/lib/brevo'
import { SOPHIE_CHAT_MONTHS, SOPHIE_DAILY_OPTIONS } from '@/lib/constants/sophie'
import { nafCodesForGroups, sectorGroup } from '@/lib/constants/client-sectors'

/** Nom de la première recherche : premier secteur choisi et zone (comme dans « Nouvelle recherche ») */
function firstSearchName(sectors: string[], departments: string[]): string {
  const first = sectorGroup(sectors[0] ?? '')?.label ?? 'Ma première recherche'
  const more = sectors.length > 1 ? ` (+${sectors.length - 1})` : ''
  const zone = departments.length === 1 ? ` · ${departments[0]}` : ` · ${departments.length} départements`
  return `${first}${more}${zone}`.slice(0, 80)
}

/**
 * Type de retour pour les actions de profil
 */
type ActionResult = {
  success: boolean
  error?: string
  // Page à charger entièrement ensuite (voir actions/auth.ts)
  redirectTo?: string
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
    const user = await getAuthUser()

    if (!user) {
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

    // Client idéal : il suit le métier choisi (poids des signaux, suggestions), et les mots-clés
    // choisis remplacent ceux proposés par défaut pour le métier
    {
      const { data: icp } = await supabase
        .from('icp_profiles')
        .select('id, criteria')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at')
        .limit(1)
        .maybeSingle()
      if (icp) {
        const criteria = validated.searchKeywords
          ? { ...((icp.criteria ?? {}) as Record<string, unknown>), search_keywords: validated.searchKeywords }
          : icp.criteria
        const { error: icpError } = await supabase
          .from('icp_profiles')
          .update({ criteria, profession_key: validated.professionKey })
          .eq('id', icp.id)
        if (icpError) console.error('Error updating the ideal client:', icpError)
      }
    }

    // Première recherche par profil : Sophie a quelque chose à chercher dès le premier jour.
    // Ses départements deviennent ceux de la prospection (si aucun n'est encore choisi), et la
    // prospection automatique démarre (lundi et jeudi à 9 h par défaut). Un échec ici ne bloque pas
    // l'inscription : la recherche peut être créée ensuite dans Prospection.
    if (validated.firstSearch) {
      const search = validated.firstSearch
      const { error: strategyError } = await supabase.from('prospect_strategies').insert({
        user_id: user.id,
        name: firstSearchName(search.sectorGroups, search.departments),
        approach: search.approach,
        filters: {
          sector_groups: search.sectorGroups,
          naf_codes: nafCodesForGroups(search.sectorGroups),
          sizes: ['tpe', 'pme'],
          departments: search.departments,
        },
      })
      if (strategyError && strategyError.code !== '23505') console.error('Error creating the first search:', strategyError)

      const { data: settings } = await supabase
        .from('prospection_settings')
        .select('departments')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!settings) {
        const { error: settingsError } = await supabase
          .from('prospection_settings')
          .insert({ user_id: user.id, departments: search.departments, is_active: true })
        if (settingsError) console.error('Error saving the first prospection settings:', settingsError)
      } else if (settings.departments.length === 0) {
        const { error: settingsError } = await supabase
          .from('prospection_settings')
          .update({ departments: search.departments })
          .eq('user_id', user.id)
        if (settingsError) console.error('Error saving the first departments:', settingsError)
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

      captureServerEvent(user.id, 'onboarding_completed', {
        profession_key: validated.professionKey,
        selected_theme: validated.selectedTheme,
        first_search: validated.firstSearch ? validated.firstSearch.approach : 'none',
        first_search_sectors: validated.firstSearch?.sectorGroups.length ?? 0,
        $set: { profession_key: validated.professionKey },
      })
      // Prénom, activité et métier connus : la fiche Brevo est complétée (e-mails de l'essai)
      syncBrevoContact(supabase, user.id)
    }
  } catch (error) {
    captureServerError(error, undefined, { action: 'complete_onboarding' })
    return {
      success: false,
      error: 'Une erreur est survenue lors de l\'onboarding',
    }
  }

  // Chargement complet du tableau de bord côté navigateur (voir redirectTo dans actions/auth.ts)
  return { success: true, redirectTo: '/dashboard' }
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
    const user = await getAuthUser()

    if (!user) {
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

    if (validated.firstName !== undefined || validated.businessName !== undefined) syncBrevoContact(supabase, user.id)

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

/**
 * Présentation et signature utilisées par Sophie pour rédiger les messages, et plafond WhatsApp du jour
 */
export async function saveMessageSettings(input: MessageSettingsInput): Promise<ActionResult> {
  try {
    const validated = messageSettingsSchema.parse(input)
    const supabase = await createClient()

    const user = await getAuthUser()

    if (!user) {
      return { success: false, error: 'Vous devez être connecté' }
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({
        message_pitch: validated.pitch,
        message_signature: validated.signature,
        ...(validated.whatsappDailyLimit !== undefined ? { whatsapp_daily_limit: validated.whatsappDailyLimit } : {}),
      })
      .eq('id', user.id)

    if (error) {
      console.error('Save message settings error:', error)
      return { success: false, error: 'Impossible d\'enregistrer vos réglages' }
    }

    revalidatePath('/settings/messages')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message ?? 'Réglages invalides' }
    }
    console.error('Save message settings error:', error)
    return { success: false, error: 'Une erreur est survenue' }
  }
}

/**
 * Dernière vue choisie sur la page Entreprises (lot 1.9) : tableau ou Kanban, gardée sur le compte.
 * Un échec n'empêche pas de changer de vue : seule la mémorisation est perdue.
 */
export async function saveCompaniesView(view: 'table' | 'kanban'): Promise<ActionResult> {
  if (view !== 'table' && view !== 'kanban') return { success: false, error: 'Vue inconnue' }
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }
  const supabase = await createClient()
  const { error } = await supabase.from('user_profiles').update({ companies_view: view }).eq('id', user.id)
  if (error) {
    console.error('Save companies view error:', error)
    return { success: false, error: 'Impossible de mémoriser la vue' }
  }
  return { success: true }
}


/**
 * Réglages de la conversation avec Sophie : ouverture automatique sur l'accueil, plafond de messages par
 * jour (consommation de la clé IA de l'utilisateur), conservation des conversations.
 */
export async function saveSophieSettings(input: {
  autoOpen: boolean
  suggestions: boolean
  dailyMessages: number
  chatMonths: number
}): Promise<ActionResult> {
  if (
    !(SOPHIE_DAILY_OPTIONS as readonly number[]).includes(input.dailyMessages) ||
    !(SOPHIE_CHAT_MONTHS as readonly number[]).includes(input.chatMonths)
  ) {
    return { success: false, error: 'Valeur non prévue' }
  }
  const user = await getAuthUser()
  if (!user) return { success: false, error: 'Vous devez être connecté' }
  const supabase = await createClient()

  const [{ error: profileError }, { error: retentionError }] = await Promise.all([
    supabase
      .from('user_profiles')
      .update({
        sophie_auto_open: input.autoOpen === true,
        sophie_suggestions: input.suggestions === true,
        sophie_daily_messages: input.dailyMessages,
      })
      .eq('id', user.id),
    supabase
      .from('data_retention_settings')
      .upsert({ user_id: user.id, sophie_chat_months: input.chatMonths, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }),
  ])
  if (profileError || retentionError) {
    captureServerError(profileError ?? retentionError, user.id, { action: 'save_sophie_settings' })
    return { success: false, error: 'Enregistrement impossible. Réessayez.' }
  }
  captureServerEvent(user.id, 'sophie_settings_saved', { ...input })
  revalidatePath('/settings/keys')
  revalidatePath('/', 'layout')
  return { success: true }
}
