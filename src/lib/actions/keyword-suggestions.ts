'use server'

import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

/**
 * Mots-clés proposés pendant la saisie : ceux des métiers, et ceux qu'au moins deux comptes utilisent
 */
export async function suggestKeywords(query: string): Promise<string[]> {
  const clean = query.trim().slice(0, 60)
  if (clean.length < 2) return []
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('suggest_search_keywords', { p_query: clean })
  if (error) {
    console.error('suggest_search_keywords', error.message)
    return []
  }
  return (data ?? []).map((row) => row.keyword).filter((keyword): keyword is string => typeof keyword === 'string')
}
