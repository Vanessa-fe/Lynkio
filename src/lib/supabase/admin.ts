import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/**
 * Client Supabase avec le rôle service_role, pour le serveur uniquement : il passe outre les règles
 * d'accès (RLS). Ne s'en servir que pour ce que l'utilisateur ne doit pas pouvoir faire lui-même,
 * comme déchiffrer sa clé d'API au moment d'appeler le service.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY manque dans les variables d\'environnement')

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Clé déchiffrée d'un utilisateur pour un service, ou null s'il n'en a pas enregistré */
export async function readUserApiKey(
  userId: string,
  provider: string
): Promise<{ apiKey: string; model: string | null } | null> {
  const { data, error } = await createAdminClient().rpc('read_user_api_key', {
    p_user_id: userId,
    p_provider: provider,
  })
  if (error) throw error
  const row = data?.[0]
  return row?.api_key ? { apiKey: row.api_key, model: row.model } : null
}
