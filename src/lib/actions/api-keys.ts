'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { checkApiKey, checkCustomAiKey } from '@/lib/api-key-checks'
import { API_KEY_SERVICES, isAiProvider, type ApiKeyProvider } from '@/lib/constants/api-keys'
import { aiProviderSchema, apiKeySchema, customAiKeySchema, type ApiKeyInput, type CustomAiKeyInput } from '@/lib/validations/api-keys'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'

type ActionResult = { success: boolean; error?: string }

// Vérifications de clé par heure et par compte : assez pour corriger une faute de copie,
// trop peu pour se servir de Filonea afin de tester des clés volées
const MAX_KEY_CHECKS_PER_HOUR = 10

/**
 * Vérifie la clé auprès de son service, puis l'enregistre chiffrée
 */
export async function saveApiKey(input: ApiKeyInput): Promise<ActionResult> {
  try {
    const { provider, key, model } = apiKeySchema.parse(input)
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { data: allowed, error: limitError } = await supabase.rpc('hit_my_rate_limit', {
      p_action: 'api_key_check',
      p_max: MAX_KEY_CHECKS_PER_HOUR,
      p_window_seconds: 3600,
    })
    if (limitError) throw limitError
    if (!allowed) {
      return { success: false, error: 'Trop d\'essais en une heure : réessayez un peu plus tard.' }
    }

    const service = API_KEY_SERVICES.find((candidate) => candidate.provider === provider)
    const check = await checkApiKey(provider, key, model ?? service?.defaultModel ?? null)
    if (!check.ok) return { success: false, error: check.error }

    const { error } = await supabase.rpc('save_my_api_key', { p_provider: provider, p_key: key, p_model: model ?? undefined })
    if (error) throw error

    if (isAiProvider(provider)) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ ai_provider: provider })
        .eq('id', user.id)
      if (profileError) throw profileError
    }

    captureServerEvent(user.id, 'api_key_saved', { provider, custom_model: model !== null })
    revalidatePath('/settings/keys')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.errors[0]?.message ?? 'Clé invalide' }
    }
    captureServerError(error, undefined, { action: 'saveApiKey' })
    return { success: false, error: 'Impossible d\'enregistrer la clé pour le moment : réessayez.' }
  }
}

/**
 * Supprime la clé d'un service (elle est aussi effacée du coffre chiffré)
 */
export async function deleteApiKey(provider: ApiKeyProvider): Promise<ActionResult> {
  try {
    if (provider !== 'custom' && !API_KEY_SERVICES.some((service) => service.provider === provider)) {
      return { success: false, error: 'Service inconnu' }
    }
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase.rpc('delete_my_api_key', { p_provider: provider })
    if (error) throw error

    if (isAiProvider(provider)) {
      // L'IA supprimée était celle de Sophie : une autre clé d'IA enregistrée prend le relais
      const { data: remaining } = await supabase.from('user_api_keys').select('provider').eq('user_id', user.id)
      const fallback = (remaining ?? []).map((row) => row.provider).find(isAiProvider) ?? null
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ ai_provider: fallback })
        .eq('id', user.id)
        .eq('ai_provider', provider)
      if (profileError) throw profileError
    }

    captureServerEvent(user.id, 'api_key_deleted', { provider })
    revalidatePath('/settings/keys')
    return { success: true }
  } catch (error) {
    captureServerError(error, undefined, { action: 'deleteApiKey' })
    return { success: false, error: 'Impossible de supprimer la clé pour le moment : réessayez.' }
  }
}

/**
 * Choisit l'IA utilisée par Sophie, parmi celles dont la clé est enregistrée
 */
export async function setAiProvider(provider: string): Promise<ActionResult> {
  try {
    const chosen = aiProviderSchema.parse(provider)
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { data: key } = await supabase
      .from('user_api_keys')
      .select('provider')
      .eq('user_id', user.id)
      .eq('provider', chosen)
      .maybeSingle()
    if (!key) return { success: false, error: 'Enregistrez d\'abord une clé pour cette IA' }

    const { error } = await supabase.from('user_profiles').update({ ai_provider: chosen }).eq('id', user.id)
    if (error) throw error

    captureServerEvent(user.id, 'ai_provider_chosen', { provider: chosen })
    revalidatePath('/settings/keys')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) return { success: false, error: 'IA inconnue' }
    captureServerError(error, undefined, { action: 'setAiProvider' })
    return { success: false, error: 'Impossible de changer d\'IA pour le moment : réessayez.' }
  }
}

/**
 * « Autre IA » : vérifie la clé et le modèle auprès du service, puis les enregistre avec l'adresse de l'API
 */
export async function saveCustomAiKey(input: CustomAiKeyInput): Promise<ActionResult> {
  try {
    const { baseUrl, model, key } = customAiKeySchema.parse(input)
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { data: allowed, error: limitError } = await supabase.rpc('hit_my_rate_limit', {
      p_action: 'api_key_check',
      p_max: MAX_KEY_CHECKS_PER_HOUR,
      p_window_seconds: 3600,
    })
    if (limitError) throw limitError
    if (!allowed) return { success: false, error: 'Trop d\'essais en une heure : réessayez un peu plus tard.' }

    const check = await checkCustomAiKey(baseUrl, key, model)
    if (!check.ok) return { success: false, error: check.error }

    const { error } = await supabase.rpc('save_my_custom_ai_key', { p_key: key, p_model: model, p_base_url: baseUrl })
    if (error) throw error

    const { error: profileError } = await supabase.from('user_profiles').update({ ai_provider: 'custom' }).eq('id', user.id)
    if (profileError) throw profileError

    captureServerEvent(user.id, 'api_key_saved', { provider: 'custom', host: new URL(baseUrl).hostname })
    revalidatePath('/settings/keys')
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) return { success: false, error: error.errors[0]?.message ?? 'Réglage invalide' }
    captureServerError(error, undefined, { action: 'saveCustomAiKey' })
    return { success: false, error: 'Impossible d\'enregistrer la clé pour le moment : réessayez.' }
  }
}
