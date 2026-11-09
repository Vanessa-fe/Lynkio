import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import type { EmailSource, LinkedinPost } from '@/types'

// Les posts ajoutés ou écartés restent visibles une semaine : de quoi répondre, ou rattraper le tri
const RECENT_DAYS = 7
const MAX_POSTS = 50
// Fin de la raison donnée par la fonction linkedin-posts aux posts qui ne sont pas en français
const OTHER_LANGUAGE_REASON = '% : seules les annonces en français sont gardées'

export type LinkedinPostSearch = {
  enabled: boolean
  keywords: string[]
  lastSearchAt: string | null
  // Dernier passage de l'extension (Chrome ouvert et extension connectée)
  extensionSeenAt: string | null
  // Ce qui empêche l'extension de lire la recherche (LinkedIn a changé sa page)
  error: string | null
  // Heure de la lecture, pour dire « il y a 3 h » sans dépendre de l'horloge du rendu
  readAt: number
}

export type AddedLinkedinPost = LinkedinPost & {
  contact: { email: string | null; email_source: EmailSource | null; opted_out_at: string | null } | null
}

export type LinkedinPosts = {
  toReview: LinkedinPost[]
  added: AddedLinkedinPost[]
  // Écartés par Sophie, sauf ceux dans une autre langue : seulement comptés, ils ne sont pas des pistes
  filtered: LinkedinPost[]
  otherLanguage: number
}

export async function getLinkedinPostSearch(): Promise<LinkedinPostSearch> {
  const readAt = Date.now()
  const search: LinkedinPostSearch = {
    enabled: false,
    keywords: [],
    lastSearchAt: null,
    extensionSeenAt: null,
    error: null,
    readAt,
  }
  const user = await getAuthUser()
  if (!user) return search

  const supabase = await createClient()
  const { data } = await supabase
    .from('linkedin_automation')
    .select('post_search_enabled, post_keywords, post_search_at, last_seen_at, post_search_error')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return search
  return {
    enabled: data.post_search_enabled,
    keywords: data.post_keywords,
    lastSearchAt: data.post_search_at,
    extensionSeenAt: data.last_seen_at,
    error: data.post_search_error,
    readAt,
  }
}

export async function getLinkedinPosts(): Promise<LinkedinPosts> {
  const empty: LinkedinPosts = { toReview: [], added: [], filtered: [], otherLanguage: 0 }
  const user = await getAuthUser()
  if (!user) return empty

  const supabase = await createClient()
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const [toReview, added, filtered, otherLanguage] = await Promise.all([
    supabase
      .from('linkedin_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(MAX_POSTS),
    supabase
      .from('linkedin_posts')
      .select('*, contact:company_contacts(email, email_source, opted_out_at)')
      .eq('user_id', user.id)
      .eq('status', 'added')
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(MAX_POSTS),
    supabase
      .from('linkedin_posts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'filtered')
      .gte('created_at', since)
      .not('filter_reason', 'like', OTHER_LANGUAGE_REASON)
      .order('created_at', { ascending: false })
      .limit(MAX_POSTS),
    supabase
      .from('linkedin_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'filtered')
      .gte('created_at', since)
      .like('filter_reason', OTHER_LANGUAGE_REASON),
  ])

  for (const result of [toReview, added, filtered, otherLanguage]) {
    if (result.error) console.error('LinkedIn posts error:', result.error)
  }

  return {
    toReview: toReview.data ?? [],
    added: (added.data ?? []) as unknown as AddedLinkedinPost[],
    filtered: filtered.data ?? [],
    otherLanguage: otherLanguage.count ?? 0,
  }
}
