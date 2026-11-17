// Conversation avec Sophie (phase 2 de la refonte). Appelée depuis le navigateur avec le jeton de
// l'utilisateur (verify_jwt), comme la rédaction de messages : Netlify coupe une action serveur au bout
// d'une dizaine de secondes, une réponse peut en prendre plus.
//
// POST, JSON : { conversationId?: uuid, message: string, context?: { page, entityType?, entityId? } }
// Réponse : un flux « text/event-stream » d'objets JSON :
//   { type: 'meta', conversationId, title }  puis  { type: 'delta', text }…
//   puis { type: 'done', messageId }  ou  { type: 'error', message }
// Erreurs avant la réponse (connexion, offre, plafond, clé manquante) : JSON { error, code }.
//
// Garde-fous : compte vérifié, offre active, plafond de messages par jour (réglable, 100 par défaut),
// 10 messages par minute, message de 4 000 caractères au plus, contexte relu côté serveur avec les
// droits de l'utilisateur, 20 derniers messages seulement envoyés à l'IA. Une réponse qui échoue est
// enregistrée comme une erreur, jamais comme une réponse.

import { createClient } from '@supabase/supabase-js'
import { accountPlan, parisMidnight, planDenial } from '../_shared/plan.ts'
import { loadAiAccess, PROVIDER_LABELS } from '../_shared/ai.ts'
import { streamChat, type ChatTurn } from '../_shared/chat.ts'
import { UserFacingError } from '../_shared/errors.ts'
import { loadPageFacts, readPageContext } from './context.ts'
import { sophieInstructions } from './prompt.ts'
import { planTools, runTool, TOOL_STATUS, type ToolResult } from './tools.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_MESSAGE_LENGTH = 4000
// Fenêtre de conversation envoyée à l'IA : les messages plus anciens restent dans l'historique affiché
const HISTORY_WINDOW = 20
const MAX_OUTPUT_TOKENS = 1200
const REQUEST_TIMEOUT_MS = 90_000
const PER_MINUTE = 10

const ALLOWED_ORIGINS = [
  /^https:\/\/(www\.)?filonea\.(fr|com)$/,
  /^https:\/\/([a-z0-9-]+--)?lynkio\.netlify\.app$/,
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/,
]

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

// Titre automatique : le début du premier message, coupé à un mot
function titleFrom(message: string): string {
  const flat = message.replace(/\s+/g, ' ').trim()
  if (flat.length <= 60) return flat || 'Nouvelle conversation'
  const cut = flat.slice(0, 60)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 30 ? cut.lastIndexOf(' ') : 60)}…`
}

function todayInParis(): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request.headers.get('Origin'))
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée' }, 405)

  let input: { conversationId?: unknown; message?: unknown; context?: unknown }
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Corps de requête invalide' }, 400)
  }
  const message = typeof input.message === 'string' ? input.message.trim() : ''
  if (!message) return json({ error: 'Écrivez votre message à Sophie' }, 400)
  if (message.length > MAX_MESSAGE_LENGTH) return json({ error: `Message trop long : ${MAX_MESSAGE_LENGTH} caractères au plus` }, 400)
  const requestedConversation =
    typeof input.conversationId === 'string' && UUID.test(input.conversationId) ? input.conversationId : null
  const context = readPageContext(input.context)

  // Jeton de l'utilisateur : la lecture du contexte passe par ses droits (RLS)
  const authorization = request.headers.get('Authorization') ?? ''
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: auth } = await supabase.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
  const user = auth?.user
  if (!user) return json({ error: 'Vous devez être connecté', code: 'auth' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const denial = planDenial(await accountPlan(admin, user.id), false)
  if (denial) return json({ error: denial.message, code: denial.code }, 403)

  const { data: profile } = await admin
    .from('user_profiles')
    .select('first_name, profession_key, sophie_daily_messages')
    .eq('id', user.id)
    .maybeSingle()

  // Plafond du jour (heure de Paris) et rythme par minute
  const dailyLimit = profile?.sophie_daily_messages ?? 100
  const { count: sentToday } = await admin
    .from('sophie_messages')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('role', 'user')
    .gte('created_at', parisMidnight(new Date()).toISOString())
  if ((sentToday ?? 0) >= dailyLimit) {
    return json(
      {
        error: `Vous avez envoyé ${dailyLimit} messages à Sophie aujourd’hui, votre plafond quotidien : elle vous répond de nouveau demain. Vous pouvez changer ce plafond dans Paramètres > Vos clés.`,
        code: 'daily_limit',
      },
      429
    )
  }
  const { data: allowed } = await admin.rpc('hit_rate_limit', { p_bucket: `sophie-chat:${user.id}`, p_max: PER_MINUTE, p_window_seconds: 60 })
  if (allowed === false) return json({ error: 'Beaucoup de messages en peu de temps : patientez une minute.', code: 'rate_limit' }, 429)

  // Clé d'IA de l'utilisateur : sans clé, pas de conversation (les fonctions sans IA restent disponibles)
  let access: Awaited<ReturnType<typeof loadAiAccess>>
  try {
    access = await loadAiAccess(admin, user.id)
  } catch (error) {
    if (error instanceof UserFacingError) return json({ error: error.message, code: 'missing_key' }, 400)
    throw error
  }

  // Conversation : celle demandée si elle appartient bien à l'utilisateur, sinon une nouvelle
  let conversationId: string
  let title: string
  const existing = requestedConversation
    ? (await admin.from('sophie_conversations').select('id, title').eq('id', requestedConversation).eq('user_id', user.id).maybeSingle()).data
    : null
  if (existing) {
    conversationId = existing.id
    title = existing.title
  } else {
    title = titleFrom(message)
    const { data: created, error } = await admin
      .from('sophie_conversations')
      .insert({ user_id: user.id, title })
      .select('id')
      .single()
    if (error || !created) {
      console.error('sophie-chat conversation', error)
      return json({ error: 'Impossible de démarrer la conversation' }, 500)
    }
    conversationId = created.id
  }

  const contextRecord = { page: context.page, entity_type: context.entityType, entity_id: context.entityId }
  const { error: userMessageError } = await admin
    .from('sophie_messages')
    .insert({ conversation_id: conversationId, user_id: user.id, role: 'user', content: message, context: contextRecord })
  if (userMessageError) {
    console.error('sophie-chat user message', userMessageError)
    return json({ error: 'Impossible d’enregistrer votre message' }, 500)
  }

  // Les 20 derniers messages réussis, du plus ancien au plus récent (le nouveau message compris)
  const { data: history } = await admin
    .from('sophie_messages')
    .select('role, content, status')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_WINDOW)
  const turns: ChatTurn[] = (history ?? [])
    .filter((row) => row.status === 'done' && row.content)
    .reverse()
    .map((row) => ({ role: row.role as ChatTurn['role'], content: row.content as string }))
  // L'IA attend une conversation qui commence par l'utilisateur
  while (turns.length > 0 && turns[0]!.role !== 'user') turns.shift()

  const [{ data: profession }, facts] = await Promise.all([
    profile?.profession_key
      ? admin.from('professions').select('label').eq('key', profile.profession_key).maybeSingle()
      : Promise.resolve({ data: null }),
    loadPageFacts(supabase, user.id, context),
  ])

  const encoder = new TextEncoder()
  const startedAt = Date.now()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      send({ type: 'meta', conversationId, title, provider: PROVIDER_LABELS[access.provider] })

      // Outils (phase 3) : choisis par le planificateur, vérifiés, exécutés avec les droits de l'utilisateur.
      // Un planificateur en panne n'empêche pas de répondre.
      let calls: Awaited<ReturnType<typeof planTools>> = []
      try {
        calls = await planTools({ access, turns, context })
      } catch (error) {
        console.error('sophie-chat planner', error instanceof Error ? error.message : error)
      }
      const results: ToolResult[] = []
      for (const call of calls) {
        send({ type: 'status', text: TOOL_STATUS[call.tool] })
        results.push(await runTool({ call, supabase, userId: user.id, context, authorization, lastMessage: message }))
      }
      const cards = results.flatMap((result) => (result.card ? [result.card] : []))
      for (const card of cards) send({ type: 'card', card })

      const system = sophieInstructions({
        firstName: profile?.first_name ?? null,
        profession: profession?.label ?? null,
        context,
        facts,
        toolFacts: results.map((result) => `[${result.tool}]\n${result.facts}`).join('\n\n'),
        today: todayInParis(),
      })

      let text = ''
      try {
        const result = await streamChat({
          access,
          system,
          turns,
          // Brouillon affiché en carte : Sophie le présente en deux phrases, elle n'en écrit pas un autre
          maxOutputTokens: cards.some((card) => card.type === 'outreach_draft') ? 600 : MAX_OUTPUT_TOKENS,
          timeoutMs: REQUEST_TIMEOUT_MS,
          onDelta: (delta) => {
            text += delta
            send({ type: 'delta', text: delta })
          },
        })
        if (!result.text.trim()) throw new UserFacingError('Sophie n’a pas pu répondre cette fois : réessayez.')
        const { data: saved } = await admin
          .from('sophie_messages')
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: 'assistant',
            content: result.text.slice(0, 20000),
            context: contextRecord,
            provider: access.provider,
            model: result.model,
            input_tokens: result.inputTokens,
            output_tokens: result.outputTokens,
            latency_ms: Date.now() - startedAt,
            cards,
            tools: results.map((result) => result.tool),
          })
          .select('id')
          .single()
        send({ type: 'done', messageId: saved?.id ?? null })
      } catch (error) {
        const shown =
          error instanceof UserFacingError ? error.message : 'Sophie n’a pas pu répondre (erreur inattendue) : réessayez dans un instant.'
        if (!(error instanceof UserFacingError)) console.error('sophie-chat stream', error)
        // L'échec est enregistré comme tel, avec le début de réponse éventuel : jamais comme une réponse réussie
        await admin.from('sophie_messages').insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: 'assistant',
          content: text.slice(0, 20000),
          context: contextRecord,
          status: 'error',
          error: shown.slice(0, 1000),
          provider: access.provider,
          cards,
          tools: results.map((result) => result.tool),
          latency_ms: Date.now() - startedAt,
        })
        send({ type: 'error', message: shown })
      } finally {
        await admin.from('sophie_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId)
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: { ...cors, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  })
})
