import { createClient } from '@/lib/supabase/server'
import type { Profession } from '@/types'

/**
 * Métiers proposés à l'onboarding (catalogue en lecture seule, commun à tous)
 */
export async function getActiveProfessions(): Promise<Profession[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('professions')
    .select('*')
    .eq('is_active', true)
    .order('order')

  return data ?? []
}
