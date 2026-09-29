import { createClient } from '@/lib/supabase/server'
import type { UserProfile } from '@/types'
import { getAuthUser } from '@/lib/supabase/auth'

/**
 * Récupérer le profil de l'utilisateur connecté
 */
export async function getUserProfile(): Promise<UserProfile | null> {
  const supabase = await createClient()

  const user = await getAuthUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return null
  }

  return data
}

/**
 * Vérifier si l'utilisateur a complété l'onboarding
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const profile = await getUserProfile()
  return profile?.onboarding_completed ?? false
}
