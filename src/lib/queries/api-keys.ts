import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

// Ce que le navigateur peut savoir d'une clé : jamais la clé elle-même
export type SavedApiKey = {
  provider: string
  keyHint: string
  model: string | null
  updatedAt: string
}

/**
 * Clés enregistrées par l'utilisateur connecté (4 derniers caractères seulement)
 */
export async function getMyApiKeys(): Promise<SavedApiKey[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const { data } = await supabase
    .from('user_api_keys')
    .select('provider, key_hint, model, updated_at')
    .eq('user_id', user.id)

  return (data ?? []).map((row) => ({
    provider: row.provider,
    keyHint: row.key_hint,
    model: row.model,
    updatedAt: row.updated_at,
  }))
}

/** L'utilisateur a-t-il une clé d'IA ? (sans elle, Sophie ne rédige pas) */
export async function hasAiKey(): Promise<boolean> {
  const keys = await getMyApiKeys()
  return keys.some((key) => key.provider === 'openai')
}
