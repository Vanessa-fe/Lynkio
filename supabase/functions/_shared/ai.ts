// Appels à l'IA avec la clé personnelle de l'utilisateur (Paramètres > Clés) : chacun paie
// directement son fournisseur. La clé est déchiffrée ici, côté serveur, juste avant l'appel ;
// elle n'est jamais écrite dans les journaux ni renvoyée au navigateur.
//
// Fournisseurs : OpenAI (API Responses), Gemini (API generateContent de Google) et « Autre IA » :
// tout service compatible avec l'API Chat Completions d'OpenAI (Mistral, DeepSeek, Groq, OpenRouter…),
// à l'adresse choisie par l'utilisateur. Ajouter un fournisseur = une fonction d'appel de plus dans
// generateJson, et l'ouvrir dans src/lib/constants/api-keys.ts et src/lib/api-key-checks.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { NoNativeWebSearchError, UserFacingError } from './errors.ts'

export type AiProvider = 'openai' | 'gemini' | 'custom'

// baseUrl : adresse de l'API, pour « Autre IA » seulement
export type AiAccess = { provider: AiProvider; apiKey: string; model: string; baseUrl?: string }

const AI_PROVIDERS: AiProvider[] = ['openai', 'gemini', 'custom']

const PROVIDER_LABELS: Record<AiProvider, string> = { openai: 'OpenAI', gemini: 'Gemini', custom: 'Votre IA' }

// Modèle conseillé quand l'utilisateur n'en a pas choisi (OPENAI_MODEL le remplace pour OpenAI).
// Gemini : Flash-Lite, le seul modèle Flash qui répond avec une clé gratuite (vérifié le 11/11/2026).
const DEFAULT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-5.6-terra',
  gemini: 'gemini-flash-lite-latest',
  // « Autre IA » : le modèle est toujours choisi par l'utilisateur
  custom: '',
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
      let baseUrl: string | undefined
      if (provider === 'custom') {
        const { data: url, error: urlError } = await admin.rpc('read_user_api_base_url', { p_user_id: userId, p_provider: provider })
        if (urlError) throw new Error(`Lecture de l'adresse de l'IA impossible : ${urlError.message}`)
        baseUrl = typeof url === 'string' ? url : undefined
        if (!baseUrl || !row.model) continue
      }
      return {
        provider,
        apiKey: row.api_key,
        model: row.model || (provider === 'openai' ? Deno.env.get('OPENAI_MODEL') : null) || DEFAULT_MODELS[provider],
        baseUrl,
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
  // Autorise l'IA à chercher sur le web
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
    case 'custom':
      return chatCompletionsJson(request)
  }
}

/**
 * Adresse d'API acceptée pour « Autre IA » : https, un vrai nom de domaine (pas d'adresse IP ni de nom
 * local), sans identifiants ni port inhabituel. Empêche d'utiliser Filonea pour appeler un service interne.
 */
export function isSafeApiBaseUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  const host = url.hostname.toLowerCase()
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    (url.port === '' || url.port === '443') &&
    host.includes('.') &&
    !/^[\d.]+$/.test(host) &&
    !host.includes(':') &&
    !/(^|\.)(localhost|local|internal|intranet|lan|home|corp|supabase\.co|supabase\.in)$/.test(host)
  )
}

// Lettres accentuées et ponctuation écrites en codes HTML par certains services (« In&egrave;s » au lieu
// de « Inès », vu avec l'adresse compatible OpenAI de Gemini en format strict, le 11/11/2026)
const HTML_ENTITIES: Record<string, string> = {
  agrave: 'à', acirc: 'â', auml: 'ä', aelig: 'æ', ccedil: 'ç', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
  icirc: 'î', iuml: 'ï', ocirc: 'ô', ouml: 'ö', oelig: 'œ', ugrave: 'ù', ucirc: 'û', uuml: 'ü', yuml: 'ÿ',
  Agrave: 'À', Acirc: 'Â', Ccedil: 'Ç', Eacute: 'É', Egrave: 'È', Ecirc: 'Ê', Icirc: 'Î', Ocirc: 'Ô', Ugrave: 'Ù', OElig: 'Œ',
  nbsp: '\u00a0', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', hellip: '…', ndash: '–',
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

// Réponse JSON d'un modèle qui n'accepte pas le schéma : parfois entourée de ```json … ```
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]
  const candidate = (fenced ?? text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  return start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate
}

/**
 * « Autre IA » : API Chat Completions compatible OpenAI. Le format JSON est imposé par schéma quand le
 * service le permet ; sinon (erreur 400 sur response_format), on demande du JSON simple, avec le schéma
 * dans les consignes. Pas de recherche web : elle demande OpenAI ou Gemini.
 */
async function chatCompletionsJson(request: JsonRequest): Promise<JsonResult> {
  const { access } = request
  if (request.webSearch) {
    throw new NoNativeWebSearchError(
      'La recherche sur le web n\'est possible qu\'avec une clé OpenAI, ou Gemini avec la facturation Google : ajoutez-en une dans Paramètres > Vos clés.'
    )
  }
  if (!access.baseUrl || !isSafeApiBaseUrl(access.baseUrl)) {
    throw new UserFacingError('L\'adresse de votre IA n\'est pas valide : corrigez-la dans Paramètres > Vos clés')
  }

  const call = async (strictSchema: boolean) => {
    const instructions = [
      request.instructions ?? '',
      strictSchema
        ? ''
        : `Réponds uniquement par un objet JSON valide, sans texte autour, qui respecte ce schéma JSON :\n${JSON.stringify(request.schema)}`,
    ]
      .filter(Boolean)
      .join('\n\n')
    try {
      return await fetch(`${access.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access.apiKey}` },
        body: JSON.stringify({
          model: access.model,
          messages: [
            ...(instructions ? [{ role: 'system', content: instructions }] : []),
            { role: 'user', content: request.input },
          ],
          response_format: strictSchema
            ? { type: 'json_schema', json_schema: { name: request.name, strict: true, schema: request.schema } }
            : { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(request.timeoutMs),
        // Une redirection pourrait mener ailleurs que l'adresse vérifiée
        redirect: 'error',
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new UserFacingError(`${request.task} a pris trop de temps : réessayez dans un instant`)
      }
      throw error
    }
  }

  let response = await call(true)
  if (response.status === 400 || response.status === 422) {
    const detail = await response.text().catch(() => '')
    if (/response_format|json_schema|schema|structured/i.test(detail)) response = await call(false)
    else throw providerError('custom', response.status, detail, request.task)
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw providerError('custom', response.status, detail, request.task)
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string | null } }[] }
  const content = body.choices?.[0]?.message?.content ?? ''
  if (!content) return { text: '', consultedUrls: new Set() }
  const json = extractJson(content)
  try {
    return { text: JSON.stringify(decodeStrings(JSON.parse(json))), consultedUrls: new Set() }
  } catch {
    return { text: json, consultedUrls: new Set() }
  }
}

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
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new UserFacingError(`${request.task} a pris trop de temps : réessayez dans un instant`)
    }
    throw error
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    // Clé invalide : Google répond 400 « API key not valid »
    if (response.status === 400 && /api key/i.test(detail)) throw providerError('gemini', 401, detail, request.task)
    if (response.status === 429 && request.webSearch) {
      throw new NoNativeWebSearchError(
        'La recherche web de Gemini n\'est pas incluse dans l\'offre gratuite de Google : activez la facturation dans Google AI Studio, ou ajoutez une clé OpenAI pour cette recherche.'
      )
    }
    throw providerError('gemini', response.status, detail, request.task)
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

async function openAiJson(request: JsonRequest): Promise<JsonResult> {
  const { access } = request
  let response: Response
  try {
    response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access.apiKey}` },
      body: JSON.stringify({
        model: access.model,
        reasoning: { effort: 'low' },
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
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new UserFacingError(`${request.task} a pris trop de temps : réessayez dans un instant`)
    }
    throw error
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw providerError(access.provider, response.status, detail, request.task)
  }

  const body = (await response.json()) as { output_text?: string; output?: unknown[] }
  return { text: openAiOutputText(body), consultedUrls: openAiConsultedUrls(body) }
}

function providerError(provider: AiProvider, status: number, detail: string, task: string): Error {
  const label = PROVIDER_LABELS[provider]
  if (status === 401 || status === 403) {
    return new UserFacingError(`${label} refuse votre clé : vérifiez-la dans Paramètres > Vos clés`)
  }
  if (status === 429) {
    return new UserFacingError(`Crédit ${label} épuisé ou trop de demandes : vérifiez votre compte ${label}`)
  }
  if (status === 404 || (status === 400 && /model/i.test(detail))) {
    return new UserFacingError(`${label} ne connaît pas le modèle choisi : corrigez-le dans Paramètres > Vos clés`)
  }
  // Le détail peut citer la requête, jamais la clé (elle n'est envoyée que dans l'en-tête)
  return new Error(`${task} : ${label} a répondu HTTP ${status} ${detail.slice(0, 200)}`)
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

export function normalizeUrl(url: string): string {
  return url.trim().replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()
}
