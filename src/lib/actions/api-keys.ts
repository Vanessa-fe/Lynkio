'use server'

import { revalidatePath } from 'next/cache'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { checkApiKey } from '@/lib/api-key-checks'
import { API_KEY_SERVICES, isAiProvider, type ApiKeyProvider } from '@/lib/constants/api-keys'
import { apiKeySchema, type ApiKeyInput } from '@/lib/validations/api-keys'
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
    if (!API_KEY_SERVICES.some((service) => service.provider === provider)) {
      return { success: false, error: 'Service inconnu' }
    }
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const supabase = await createClient()
    const { error } = await supabase.rpc('delete_my_api_key', { p_provider: provider })
    if (error) throw error

    if (isAiProvider(provider)) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ ai_provider: null })
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
