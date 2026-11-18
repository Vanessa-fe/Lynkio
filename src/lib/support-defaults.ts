import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

/** Nom et adresse déjà connus (compte connecté), pour préremplir le formulaire d'aide */
export async function supportDefaults(): Promise<{ name: string; email: string }> {
  const user = await getAuthUser()
  if (!user) return { name: '', email: '' }
  const supabase = await createClient()
  const { data } = await supabase.from('user_profiles').select('first_name').eq('id', user.id).maybeSingle()
  return { name: data?.first_name ?? '', email: user.email ?? '' }
}
