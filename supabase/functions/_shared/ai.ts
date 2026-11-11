// Appels à l'IA avec la clé personnelle de l'utilisateur (Paramètres > Clés) : chacun paie
// directement son fournisseur, recherches sur Internet comprises. La clé est déchiffrée ici, côté
// serveur, juste avant l'appel ; elle n'est jamais écrite dans les journaux ni renvoyée au navigateur.
//
// Fournisseurs : OpenAI (API Responses), Gemini (API generateContent de Google) et Claude (API Messages
// d'Anthropic, avec sa bibliothèque officielle). Chacun utilise sa propre recherche sur Internet.
// Ajouter un fournisseur = une fonction d'appel de plus dans generateJson, et l'ouvrir dans
// src/lib/constants/api-keys.ts et src/lib/api-key-checks.ts.

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFacingError } from './errors.ts'

export type AiProvider = 'openai' | 'gemini' | 'anthropic'

export type AiAccess = { provider: AiProvider; apiKey: string; model: string }

const AI_PROVIDERS: AiProvider[] = ['openai', 'gemini', 'anthropic']

const PROVIDER_LABELS: Record<AiProvider, string> = { openai: 'OpenAI', gemini: 'Gemini', anthropic: 'Claude' }

// Modèle conseillé quand l'utilisateur n'en a pas choisi (OPENAI_MODEL le remplace pour OpenAI).
// Gemini : Flash-Lite, le seul modèle Flash qui répond avec une clé gratuite (vérifié le 11/11/2026).
const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-5.6-terra',
  gemini: 'gemini-flash-lite-latest',
  anthropic: 'claude-opus-5-5',
}

// Où l'utilisateur règle son compte (crédit, facturation)
const BILLING_PAGES: Record<AiProvider, string> = {
  openai: 'platform.openai.com (Settings > Billing)',
  gemini: 'Google AI Studio (aistudio.google.com)',
  anthropic: 'platform.claude.com (Settings > Billing)',
}

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export const MISSING_AI_KEY_MESSAGE =
  'Ajoutez la clé de votre IA dans Paramètres > Vos clés : Sophie l\'utilise pour rédiger et pour ses recherches IA.'

/**
 * Clé et modèle d'IA de l'utilisateur. Le client doit avoir le rôle service_role :
 * lui seul peut déchiffrer une clé.
 */
export async function loadAiAccess(admin: SupabaseClient, userId: string): Promise<AiAccess> {
  const { data: profile } = await admin.from('user_profiles').select('ai_provider').eq('id', userId).maybeSingle()
  const preferred = (profile?.ai_provider ?? null) as string | null
  const order = [
    ...AI_PROVIDERS.filter((provider) => provider === preferred),
    ...AI_PROVIDERS.filter((provider) => provider !== preferred),
  ]

  for (const provider of order) {
    const { data, error } = await admin.rpc('read_user_api_key', { p_user_id: userId, p_provider: provider })
    if (error) throw new Error(`Lecture de la clé ${provider} impossible : ${error.message}`)
    const row = ((data ?? []) as { api_key: string; model: string | null }[])[0]
    if (row?.api_key) {
      return {
        provider,
        apiKey: row.api_key,
        model: row.model || (provider === 'openai' ? Deno.env.get('OPENAI_MODEL') : null) || DEFAULT_MODELS[provider],
      }
    }
  }

  throw new UserFacingError(MISSING_AI_KEY_MESSAGE)
}

export type JsonRequest = {
  access: AiAccess
  // Nom du format attendu (lettres, chiffres, _)
  name: string
  schema: Record<string, unknown>
  instructions?: string
  input: string
  // Autorise l'IA à chercher sur le web (avec sa propre recherche, payée par l'utilisateur)
  webSearch?: boolean
  timeoutMs: number
  // Ce que fait l'IA, pour les messages d'erreur : « La rédaction », « La recherche IA »
  task: string
}

export type JsonResult = {
  // Réponse de l'IA, au format JSON demandé
  text: string
  // Pages réellement consultées par la recherche web (adresses normalisées)
  consultedUrls: Set<string>
}

export async function generateJson(request: JsonRequest): Promise<JsonResult> {
  switch (request.access.provider) {
    case 'openai':
      return openAiJson(request)
    case 'gemini':
      return geminiJson(request)
    case 'anthropic':
      return anthropicJson(request)
  }
}

// Lettres accentuées et ponctuation écrites en codes HTML par certains services (« In&egrave;s » au lieu
// de « Inès », vu avec l'adresse compatible OpenAI de Gemini en format strict, le 11/11/2026)
const HTML_ENTITIES: Record<string, string> = {
  agrave: 'à', acirc: 'â', auml: 'ä', aelig: 'æ', ccedil: 'ç', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', oelig: 'œ', ugrave: 'ù', ucirc: 'û', uuml: 'ü', yuml: 'ÿ',
  Agrave: 'À', Acirc: 'Â', Ccedil: 'Ç', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Icirc: 'Î', Ocirc: 'Ô', Ugrave: 'Ù', OElig: 'Œ',
  nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–',
  mdash: '—', euro: '€', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const point = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(point) && point > 0 && point < 0x110000 ? String.fromCodePoint(point) : match
    }
    return HTML_ENTITIES[code] ?? match
  })
}

function decodeStrings(value: unknown): unknown {
  if (typeof value === 'string') return decodeHtmlEntities(value)
  if (Array.isArray(value)) return value.map(decodeStrings)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decodeStrings(item)]))
  }
  return value
}

// Réponse JSON écrite librement (sans format imposé) : parfois entourée de ```json … ``` ou d'une phrase
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced ?? text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate
}

function timeoutError(task: string): UserFacingError {
  return new UserFacingError(`${task} a pris trop de temps : réessayez dans un instant`)
}

// ---------------------------------------------------------------------------------------------
// Messages d'erreur, les mêmes pour les trois fournisseurs : clé refusée, crédit épuisé ou
// facturation à activer, trop de demandes, modèle inconnu ou incompatible avec la recherche web.

function keyRefused(provider: AiProvider): UserFacingError {
  return new UserFacingError(`${PROVIDER_LABELS[provider]} refuse votre clé : vérifiez-la dans Paramètres > Vos clés`)
}

function noCredit(provider: AiProvider): UserFacingError {
  return new UserFacingError(
    `Votre compte ${PROVIDER_LABELS[provider]} n'a plus de crédit : ajoutez-en sur ${BILLING_PAGES[provider]}, puis réessayez.`
  )
}

function tooManyRequests(provider: AiProvider): UserFacingError {
  return new UserFacingError(`${PROVIDER_LABELS[provider]} reçoit trop de demandes de votre compte en même temps : réessayez dans une minute.`)
}

function unknownModel(provider: AiProvider, model: string): UserFacingError {
  return new UserFacingError(
    `${PROVIDER_LABELS[provider]} ne connaît pas le modèle « ${model} » : laissez le champ Modèle vide dans Paramètres > Vos clés pour prendre le modèle conseillé.`
  )
}

function noWebSearchModel(provider: AiProvider, model: string): UserFacingError {
  return new UserFacingError(
    `Le modèle « ${model} » ne permet pas la recherche sur Internet : choisissez un autre modèle ${PROVIDER_LABELS[provider]} dans Paramètres > Vos clés (laissez le champ vide pour le modèle conseillé, ${DEFAULT_MODELS[provider]}).`
  )
}

function unavailable(provider: AiProvider): UserFacingError {
  return new UserFacingError(`${PROVIDER_LABELS[provider]} est surchargé ou indisponible pour le moment : réessayez dans quelques minutes.`)
}

// Le détail peut citer la requête, jamais la clé (elle n'est envoyée que dans l'en-tête)
function unexpected(provider: AiProvider, status: number, detail: string, task: string): Error {
  return new Error(`${task} : ${PROVIDER_LABELS[provider]} a répondu HTTP ${status} ${detail.slice(0, 200)}`)
}

// ---------------------------------------------------------------------------------------------
// Gemini

async function geminiJson(request: JsonRequest): Promise<JsonResult> {
  const { access } = request
  let response: Response
  try {
    response = await fetch(`${GEMINI_URL}/${encodeURIComponent(access.model)}:generateContent`, {
      method: 'POST',
      // La clé dans l'en-tête, jamais dans l'adresse (les adresses finissent dans les journaux)
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': access.apiKey },
      body: JSON.stringify({
        ...(request.instructions ? { systemInstruction: { parts: [{ text: request.instructions }] } } : {}),
        contents: [{ role: 'user', parts: [{ text: request.input }] }],
        ...(request.webSearch ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: request.schema },
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw timeoutError(request.task)
    throw error
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    // Clé invalide : Google répond 400 « API key not valid »
    if ((response.status === 400 && /api key/i.test(detail)) || response.status === 401) throw keyRefused('gemini')
    if (response.status === 403) {
      if (/billing|paid/i.test(detail)) throw geminiNeedsBilling(request)
      throw keyRefused('gemini')
    }
    if (request.webSearch && response.status === 400 && /search|grounding/i.test(detail) && /not supported|unsupported/i.test(detail)) {
      throw noWebSearchModel('gemini', access.model)
    }
    // L'offre gratuite de Google ne comprend pas la recherche sur Internet (« Not available » au 11/11/2026)
    if (response.status === 429) throw request.webSearch ? geminiNeedsBilling(request) : geminiFreeLimit()
    if (response.status === 404 || (response.status === 400 && /model/i.test(detail))) throw unknownModel('gemini', access.model)
    if (response.status >= 500) throw unavailable('gemini')
    throw unexpected('gemini', response.status, detail, request.task)
  }

  const body = (await response.json()) as {
    candidates?: {
      content?: { parts?: { text?: string; thought?: boolean }[] }
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] }
    }[]
  }
  const candidate = body.candidates?.[0]
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  const consultedUrls = new Set(
    (candidate?.groundingMetadata?.groundingChunks ?? [])
      .map((chunk) => chunk.web?.uri)
      .filter((uri): uri is string => !!uri)
      .map(normalizeUrl)
  )
  return { text, consultedUrls }
}

function geminiNeedsBilling(request: JsonRequest): UserFacingError {
  return request.webSearch
    ? new UserFacingError(
        'La recherche sur Internet de Gemini demande la facturation Google : l\'offre gratuite ne la comprend pas. Activez la facturation dans Google AI Studio (aistudio.google.com), puis réessayez.'
      )
    : new UserFacingError('Votre compte Gemini demande d\'activer la facturation dans Google AI Studio (aistudio.google.com).')
}

function geminiFreeLimit(): UserFacingError {
  return new UserFacingError(
    'Vous avez atteint la limite gratuite de Gemini : réessayez plus tard, ou activez la facturation dans Google AI Studio (aistudio.google.com).'
  )
}

// ---------------------------------------------------------------------------------------------
// OpenAI

async function openAiJson(request: JsonRequest): Promise<JsonResult> {
  const { access } = request

  const call = async (withReasoning: boolean) => {
    try {
      return await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access.apiKey}` },
        body: JSON.stringify({
          model: access.model,
          ...(withReasoning ? { reasoning: { effort: 'low' } } : {}),
          ...(request.instructions ? { instructions: request.instructions } : {}),
          ...(request.webSearch
            ? { tools: [{ type: 'web_search', search_context_size: 'medium' }], include: ['web_search_call.action.sources'] }
            : {}),
          input: request.input,
          text: { format: { type: 'json_schema', name: request.name, strict: true, schema: request.schema } },
          store: false,
        }),
        signal: AbortSignal.timeout(request.timeoutMs),
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') throw timeoutError(request.task)
      throw error
    }
  }

  let response = await call(true)
  let detail = response.ok ? '' : await response.text().catch(() => '')
  // Modèle sans raisonnement (gpt-4.1, gpt-4o…) : il refuse le réglage « reasoning »
  if (response.status === 400 && /reasoning/i.test(detail) && /not supported|unsupported/i.test(detail)) {
    response = await call(false)
    detail = response.ok ? '' : await response.text().catch(() => '')
  }

  if (!response.ok) {
    const code = openAiErrorCode(detail)
    if (response.status === 401 || response.status === 403) throw keyRefused('openai')
    if (response.status === 429) throw code === 'insufficient_quota' ? noCredit('openai') : tooManyRequests('openai')
    if (request.webSearch && response.status === 400 && /web_search|hosted tool|tool.*not supported/i.test(detail)) {
      throw noWebSearchModel('openai', access.model)
    }
    if (response.status === 404 || code === 'model_not_found' || (response.status === 400 && /model/i.test(detail))) {
      throw unknownModel('openai', access.model)
    }
    if (response.status >= 500) throw unavailable('openai')
    throw unexpected('openai', response.status, detail, request.task)
  }

  const body = (await response.json()) as { output_text?: string; output?: unknown[] }
  return { text: openAiOutputText(body), consultedUrls: openAiConsultedUrls(body) }
}

function openAiErrorCode(detail: string): string | null {
  try {
    const parsed = JSON.parse(detail) as { error?: { code?: string | null; type?: string | null } }
    return parsed.error?.code ?? parsed.error?.type ?? null
  } catch {
    return null
  }
}

function openAiOutputText(response: { output_text?: string; output?: unknown[] }): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text
  return (response.output ?? [])
    .flatMap((item) => (item as { content?: { text?: string }[] }).content ?? [])
    .map((block) => block.text)
    .filter((text): text is string => typeof text === 'string')
    .join('\n')
}

function openAiConsultedUrls(response: { output?: unknown[] }): Set<string> {
  const urls = new Set<string>()
  for (const item of response.output ?? []) {
    const entry = item as {
      action?: { sources?: { url?: string }[] }
      content?: { annotations?: { type?: string; url?: string }[] }[]
    }
    for (const source of entry.action?.sources ?? []) if (source.url) urls.add(normalizeUrl(source.url))
    for (const block of entry.content ?? []) {
      for (const annotation of block.annotations ?? []) {
        if (annotation.type === 'url_citation' && annotation.url) urls.add(normalizeUrl(annotation.url))
      }
    }
  }
  return urls
}

// ---------------------------------------------------------------------------------------------
// Claude (Anthropic)

// Repli automatique d'Anthropic quand un filtre de sécurité refuse à tort (modèles qui l'acceptent)
const ANTHROPIC_FALLBACK_MODELS = /^claude-(fable-5-[12]|opus-5|opus-5-5|sonnet-5-5)$/
// Recherche web avec filtrage dynamique (moins de texte lu, donc moins cher) : modèles récents ;
// les autres prennent la recherche de base
const ANTHROPIC_DYNAMIC_SEARCH_MODELS = /^claude-((fable|mythos)-5|opus-5|opus-4-[6-9]|sonnet-5|sonnet-4-6)/
// Recherches au plus par demande : de quoi trouver une dizaine d'entreprises sans faire exploser le coût
const ANTHROPIC_MAX_SEARCHES = 8
// Tours de recherche que l'API peut mettre en pause (« pause_turn ») avant qu'on abandonne
const ANTHROPIC_MAX_CONTINUATIONS = 3

type AnthropicContent = { type: string; text?: string; content?: unknown; citations?: { type?: string; url?: string }[] | null }
type AnthropicResponse = { content: AnthropicContent[]; stop_reason: string | null }
type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown }
type AnthropicOptions = { effort: boolean; fallbacks: boolean; dynamicSearch: boolean }

async function anthropicJson(request: JsonRequest): Promise<JsonResult> {
  const { access } = request
  const client = new Anthropic({ apiKey: access.apiKey, maxRetries: 1, timeout: request.timeoutMs })

  // Réglages retirés un par un si le modèle en refuse un (vieux modèle, recherche de base seulement…)
  const options: AnthropicOptions = {
    effort: true,
    fallbacks: ANTHROPIC_FALLBACK_MODELS.test(access.model),
    dynamicSearch: ANTHROPIC_DYNAMIC_SEARCH_MODELS.test(access.model),
  }

  // Avec la recherche web, le format JSON imposé est refusé (les citations des sources sont toujours
  // actives) : le schéma est donné dans la consigne et la réponse est lue comme du JSON
  const input = request.webSearch
    ? `${request.input}\n\nRéponds uniquement par un objet JSON valide, sans texte autour, qui respecte ce schéma JSON :\n${JSON.stringify(request.schema)}`
    : request.input

  const send = (messages: AnthropicMessage[]) =>
    client.beta.messages.create({
      model: access.model,
      max_tokens: 16000,
      ...(request.instructions ? { system: request.instructions } : {}),
      messages,
      output_config: {
        ...(options.effort ? { effort: 'low' } : {}),
        ...(request.webSearch ? {} : { format: { type: 'json_schema', schema: request.schema } }),
      },
      ...(request.webSearch
        ? {
            tools: [
              {
                type: options.dynamicSearch ? 'web_search_20260209' : 'web_search_20250305',
                name: 'web_search',
                max_uses: ANTHROPIC_MAX_SEARCHES,
                user_location: { type: 'approximate', country: 'FR', timezone: 'Europe/Paris' },
              },
            ],
          }
        : {}),
      ...(options.fallbacks ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : {}),
    } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming) as unknown as Promise<AnthropicResponse>

  const messages: AnthropicMessage[] = [{ role: 'user', content: input }]
  const seen: AnthropicContent[] = []
  let response: AnthropicResponse | null = null

  for (let turn = 0; turn <= ANTHROPIC_MAX_CONTINUATIONS; turn++) {
    response = await sendAdjusting(send, messages, options, request)
    seen.push(...response.content)
    // Recherche longue mise en pause par l'API : on renvoie le tour tel quel pour qu'elle reprenne
    if (response.stop_reason !== 'pause_turn') break
    messages.push({ role: 'assistant', content: response.content })
  }
  if (!response) return { text: '', consultedUrls: new Set() }

  if (response.stop_reason === 'refusal') {
    throw new UserFacingError('Claude a refusé de traiter cette demande : reformulez vos consignes à Sophie, ou utilisez une autre IA.')
  }
  if (response.stop_reason === 'pause_turn') throw timeoutError(request.task)

  const consultedUrls = anthropicConsultedUrls(seen)
  const searchErrors = anthropicSearchErrors(seen)
  if (request.webSearch && searchErrors.length > 0 && consultedUrls.size === 0) {
    if (searchErrors.includes('too_many_requests')) throw tooManyRequests('anthropic')
    throw new UserFacingError('La recherche sur Internet de Claude n\'a pas abouti : réessayez dans quelques minutes.')
  }

  const text = response.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('')
  if (!text) return { text: '', consultedUrls }
  const json = request.webSearch ? extractJson(text) : text
  try {
    return { text: JSON.stringify(decodeStrings(JSON.parse(json))), consultedUrls }
  } catch {
    if (response.stop_reason === 'max_tokens') {
      throw new UserFacingError(`${request.task} a produit une réponse trop longue : réessayez.`)
    }
    return { text: json, consultedUrls }
  }
}

/**
 * Envoie la demande, en retirant un réglage que le modèle refuse (au plus une fois chacun), et
 * traduit les erreurs d'Anthropic en messages clairs.
 */
async function sendAdjusting(
  send: (messages: AnthropicMessage[]) => Promise<AnthropicResponse>,
  messages: AnthropicMessage[],
  options: AnthropicOptions,
  request: JsonRequest
): Promise<AnthropicResponse> {
  const { access } = request
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await send(messages)
    } catch (error) {
      if (error instanceof Anthropic.APIConnectionTimeoutError) throw timeoutError(request.task)
      if (!(error instanceof Anthropic.APIError)) throw error
      const status = error.status ?? 0
      const detail = error.message ?? ''

      if (status === 400) {
        // Modèles plus anciens : pas de réglage d'effort, pas de repli, recherche de base seulement
        if (options.effort && /effort/i.test(detail)) {
          options.effort = false
          continue
        }
        if (options.fallbacks && /fallback/i.test(detail)) {
          options.fallbacks = false
          continue
        }
        if (options.dynamicSearch && /allowed_callers|web_search_2026/i.test(detail)) {
          options.dynamicSearch = false
          continue
        }
        if (/credit balance|billing/i.test(detail)) throw noCredit('anthropic')
        if (/web search/i.test(detail) && /not enabled|disabled/i.test(detail)) {
          throw new UserFacingError(
            'La recherche sur Internet est désactivée sur votre compte Claude : un administrateur peut la réactiver sur platform.claude.com (Settings > Capabilities).'
          )
        }
        if (request.webSearch && /web_search/i.test(detail) && /not supported|unsupported/i.test(detail)) {
          throw noWebSearchModel('anthropic', access.model)
        }
        if (/model/i.test(detail)) throw unknownModel('anthropic', access.model)
      }
      if (status === 401) throw keyRefused('anthropic')
      if (status === 402) throw noCredit('anthropic')
      if (status === 403) {
        throw new UserFacingError('Votre clé Claude n\'a pas le droit d\'utiliser ce modèle : vérifiez ses droits sur platform.claude.com.')
      }
      if (status === 404) throw unknownModel('anthropic', access.model)
      if (status === 429) throw tooManyRequests('anthropic')
      if (status === 529 || status >= 500) throw unavailable('anthropic')
      throw unexpected('anthropic', status, detail, request.task)
    }
  }
  throw unexpected('anthropic', 400, 'réglages refusés', request.task)
}

// Pages lues par la recherche web : résultats de recherche et sources citées
function anthropicConsultedUrls(blocks: AnthropicContent[]): Set<string> {
  const urls = new Set<string>()
  for (const block of blocks) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const result of block.content as { url?: string }[]) if (result.url) urls.add(normalizeUrl(result.url))
    }
    for (const citation of block.citations ?? []) {
      if (citation.type === 'web_search_result_location' && citation.url) urls.add(normalizeUrl(citation.url))
    }
  }
  return urls
}

// Une recherche en erreur ne fait pas échouer l'appel (réponse 200) : son code est dans le résultat
function anthropicSearchErrors(blocks: AnthropicContent[]): string[] {
  return blocks
    .filter((block) => block.type === 'web_search_tool_result' && block.content && !Array.isArray(block.content))
    .map((block) => (block.content as { error_code?: string }).error_code ?? 'unavailable')
}

export function normalizeUrl(url: string): string {
  return url.trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
}
