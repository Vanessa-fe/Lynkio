import 'server-only'
import { cache } from 'react'
import { createClient } from './server'

export type AuthUser = { id: string }

/**
 * Utilisateur connecté, ou null.
 *
 * getClaims() vérifie le jeton de session avec la clé publique du projet (ES256),
 * sans appel réseau : getUser() interrogeait Supabase (Londres) à chaque requête,
 * plusieurs fois par page. cache() partage le résultat entre toutes les requêtes
 * d'un même affichage de page.
 */
export const getAuthUser = cache(async (): Promise<AuthUser | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const id = data?.claims?.sub
  if (error || typeof id !== 'string') return null
  return { id }
})
