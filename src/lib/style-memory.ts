import 'server-only'
import type { createClient } from '@/lib/supabase/server'
import {
  cleanExample,
  isWrittenByHer,
  MIN_EXAMPLE_LENGTH,
  STYLE_EXAMPLES_PER_CHANNEL,
  type StyleChannel,
} from '@/lib/message-style'

type Supabase = Awaited<ReturnType<typeof createClient>>

// Brouillons de Sophie comparés : ceux du dernier mois (la table n'en garde pas plus)
const DRAFTS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const DRAFTS_COMPARED = 30

/**
 * Au moment où la freelance valide un message (envoyé, enregistré, copié), le garde comme exemple de son
 * style s'il est vraiment à elle : écrit ou réécrit, pas un brouillon de Sophie accepté tel quel
 * (message-style.ts). Garde les 5 derniers par canal. Ne bloque jamais l'action qui l'appelle.
 * previous : la version enregistrée juste avant (un texte qui n'a pas changé n'apprend rien).
 */
export async function rememberWrittenMessage(
  supabase: Supabase,
  userId: string,
  channel: StyleChannel,
  text: string,
  previous?: string | null
): Promise<boolean> {
  try {
    const content = cleanExample(text)
    if (content.length < MIN_EXAMPLE_LENGTH) return false

    const [drafts, examples] = await Promise.all([
      supabase
        .from('sophie_drafts')
        .select('body')
        .eq('user_id', userId)
        .eq('channel', channel)
        .gte('created_at', new Date(Date.now() - DRAFTS_WINDOW_MS).toISOString())
        .order('created_at', { ascending: false })
        .limit(DRAFTS_COMPARED),
      supabase
        .from('message_style_examples')
        .select('id, content')
        .eq('user_id', userId)
        .eq('channel', channel)
        .order('created_at', { ascending: false }),
    ])
    if (drafts.error || examples.error) {
      console.error('Style memory read error:', drafts.error ?? examples.error)
      return false
    }

    const kept = examples.data ?? []
    if (
      !isWrittenByHer(content, {
        previous: previous ? cleanExample(previous) : null,
        sophieDrafts: (drafts.data ?? []).map((draft) => draft.body),
        examples: kept.map((example) => example.content),
      })
    ) {
      return false
    }

    const { error } = await supabase.from('message_style_examples').insert({ user_id: userId, channel, content })
    if (error) {
      console.error('Style memory insert error:', error)
      return false
    }

    // 5 au plus par canal : les plus anciens partent
    const outdated = kept.slice(STYLE_EXAMPLES_PER_CHANNEL - 1).map((example) => example.id)
    if (outdated.length > 0) await supabase.from('message_style_examples').delete().in('id', outdated)
    return true
  } catch (error) {
    console.error('Style memory error:', error)
    return false
  }
}
