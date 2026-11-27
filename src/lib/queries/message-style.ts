import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { STYLE_CHANNELS, type StyleChannel } from '@/lib/message-style'

export type StyleExample = { id: string; channel: StyleChannel; content: string; createdAt: string }

/** Messages écrits ou réécrits par la freelance que Sophie prend pour modèles, les plus récents d'abord */
export async function getStyleExamples(): Promise<StyleExample[]> {
  const user = await getAuthUser()
  if (!user) return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('message_style_examples')
    .select('id, channel, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Style examples error:', error)
    return []
  }

  return (data ?? [])
    .filter((row): row is typeof row & { channel: StyleChannel } => STYLE_CHANNELS.includes(row.channel as StyleChannel))
    .map((row) => ({ id: row.id, channel: row.channel, content: row.content, createdAt: row.created_at }))
}
