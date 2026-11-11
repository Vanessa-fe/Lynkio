// Appels à l'IA avec la clé personnelle de l'utilisateur (Paramètres > Clés) : chacun paie
// directement son fournisseur. La clé est déchiffrée ici, côté serveur, juste avant l'appel ;
// elle n'est jamais écrite dans les journaux ni renvoyée au navigateur.
//
// Fournisseurs : OpenAI (API Responses) et Gemini (API generateContent de Google). Ajouter un
// fournisseur = une fonction d'appel de plus dans generateJson, et l'ouvrir dans
// src/lib/constants/api-keys.ts et src/lib/api-key-checks.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFacingError } from './errors.ts'

export type AiProvider = 'openai' | 'gemini'

export type AiAccess = { provider: AiProvider; apiKey: string; model: string }

const AI_PROVIDERS: AiProvider[] = ['openai', 'gemini']

const PROVIDER_LABELS: Record<AiProvider, string> = { openai: 'OpenAI', gemini: 'Gemini' }

// Modèle conseillé quand l'utilisateur n'en a pas choisi (OPENAI_MODEL le remplace pour OpenAI).
// Gemini : Flash-Lite, le seul modèle Flash qui répond avec une clé gratuite (vérifié le 11/11/2026).
const DEFAULT_MODELS: Record<AiProvider, string> = { openai: 'gpt-5.6-terra', gemini: 'gemini-flash-lite-latest' }

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses'
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

export const MISSING_AI_KEY_MESSAGE =
  'Ajoutez votre clé OpenAI ou Gemini dans Paramètres > Vos clés : Sophie l\'utilise pour rédiger et pour ses recherches IA.'

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
      throw new UserFacingError(
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
