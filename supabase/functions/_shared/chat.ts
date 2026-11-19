// Conversation avec Sophie (phase 2 de la refonte) : réponse en texte libre, affichée au fil de l'eau,
// avec la clé de l'utilisateur (Paramètres > Vos clés), pour OpenAI, Gemini et Claude.
//
// Différences avec generateJson (_shared/ai.ts) : plusieurs tours de conversation, réponse progressive
// (streaming), pas de recherche sur Internet, et un modèle économique par défaut (décision du 17/11/2026 :
// « modèle léger par fournisseur pour discuter, le modèle choisi reste celui de la rédaction »). Si le
// modèle léger n'est pas accessible avec la clé, on reprend le modèle choisi par l'utilisateur.
// Les messages d'erreur sont ceux de _shared/ai.ts : clé refusée, crédit épuisé, trop de demandes…

import Anthropic from '@anthropic-ai/sdk'
import { UserFacingError } from './errors.ts'
import {
  GEMINI_URL,
  OPENAI_RESPONSES_URL,
  geminiFreeLimit,
  keyRefused,
  noCredit,
  openAiErrorCode,
  timeoutError,
  tooManyRequests,
  unavailable,
  unexpected,
  unknownModel,
  withFundedErrors,
  type AiAccess,
  type AiProvider,
} from './ai.ts'

// Modèles économiques pour discuter (vérifiés le 17/11/2026)
export const CHAT_MODELS: Record<AiProvider, string> = {
  openai: 'gpt-5-mini',
  gemini: 'gemini-flash-lite-latest',
  anthropic: 'claude-haiku-5-5',
}

const TASK = 'La réponse de Sophie'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export type ChatRequest = {
  access: AiAccess
  system: string
  turns: ChatTurn[]
  maxOutputTokens: number
  timeoutMs: number
  // Chaque morceau de texte reçu, dans l'ordre
  onDelta: (text: string) => void
}

export type ChatResult = { text: string; model: string; inputTokens: number | null; outputTokens: number | null }

/**
 * Réponse de Sophie, au fil de l'eau. Modèle économique d'abord ; s'il est inconnu pour cette clé (et
 * qu'aucun texte n'est encore parti), on réessaie avec le modèle choisi par l'utilisateur.
 */
export function streamChat(request: ChatRequest): Promise<ChatResult> {
  return withFundedErrors(request.access, () => streamChatWithFallback(request))
}

async function streamChatWithFallback(request: ChatRequest): Promise<ChatResult> {
  const light = CHAT_MODELS[request.access.provider]
  let started = false
  const onDelta = (text: string) => {
    started = true
    request.onDelta(text)
  }
  try {
    return await streamWith({ ...request, onDelta }, light)
  } catch (error) {
    const isUnknownModel = error instanceof UserFacingError && /ne connaît pas le modèle/.test(error.message)
    if (!started && isUnknownModel && request.access.model !== light) {
      return await streamWith({ ...request, onDelta }, request.access.model)
    }
    throw error
  }
}

function streamWith(request: ChatRequest, model: string): Promise<ChatResult> {
  switch (request.access.provider) {
    case 'openai':
      return openAiStream(request, model)
    case 'gemini':
      return geminiStream(request, model)
    case 'anthropic':
      return anthropicStream(request, model)
  }
}

/** Lit un flux « text/event-stream » et rend chaque objet JSON des lignes « data: » */
async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    // Gemini sépare ses événements par « \r\n\r\n » : on ramène tout à « \n »
    buffer += value.replace(/\r\n?/g, '\n')
    let separator: number
    while ((separator = buffer.indexOf('\n\n')) >= 0) {
      const chunk = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      const data = chunk
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('')
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data) as Record<string, unknown>
      } catch {
        // morceau illisible : ignoré
      }
    }
  }
}

function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

// ---------------------------------------------------------------------------------------------
// OpenAI (API Responses, stream: true)

async function openAiStream(request: ChatRequest, model: string): Promise<ChatResult> {
  const { access } = request
  const call = (withReasoning: boolean) =>
    fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access.apiKey}` },
      body: JSON.stringify({
        model,
        ...(withReasoning ? { reasoning: { effort: 'low' } } : {}),
        instructions: request.system,
        input: request.turns.map((turn) => ({ role: turn.role, content: turn.content })),
        max_output_tokens: request.maxOutputTokens,
        stream: true,
        store: false,
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
    })

  try {
    let response = await call(true)
    let detail = response.ok ? '' : await response.text().catch(() => '')
    // Modèle sans raisonnement : il refuse le réglage « reasoning »
    if (response.status === 400 && /reasoning/i.test(detail) && /not supported|unsupported/i.test(detail)) {
      response = await call(false)
      detail = response.ok ? '' : await response.text().catch(() => '')
    }
    if (!response.ok || !response.body) {
      const code = openAiErrorCode(detail)
      if (response.status === 401 || response.status === 403) throw keyRefused('openai')
      if (response.status === 429) throw code === 'insufficient_quota' ? noCredit('openai') : tooManyRequests('openai')
      if (response.status === 404 || code === 'model_not_found' || (response.status === 400 && /model/i.test(detail))) {
        throw unknownModel('openai', model)
      }
      if (response.status >= 500) throw unavailable('openai')
      throw unexpected('openai', response.status, detail, TASK)
    }

    let text = ''
    let usage: { input_tokens?: number; output_tokens?: number } | undefined
    for await (const event of sseEvents(response.body)) {
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
        text += event.delta
        request.onDelta(event.delta)
      } else if (event.type === 'response.completed') {
        usage = (event.response as { usage?: typeof usage } | undefined)?.usage
      } else if (event.type === 'response.failed' || event.type === 'error') {
        throw unavailable('openai')
      }
    }
    return { text, model, inputTokens: usage?.input_tokens ?? null, outputTokens: usage?.output_tokens ?? null }
  } catch (error) {
    if (isTimeout(error)) throw timeoutError(TASK)
    throw error
  }
}

// ---------------------------------------------------------------------------------------------
// Gemini (streamGenerateContent, format SSE)

async function geminiStream(request: ChatRequest, model: string): Promise<ChatResult> {
  const { access } = request
  try {
    const response = await fetch(`${GEMINI_URL}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      // La clé dans l'en-tête, jamais dans l'adresse (les adresses finissent dans les journaux)
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': access.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: request.turns.map((turn) => ({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }],
        })),
        generationConfig: { maxOutputTokens: request.maxOutputTokens },
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
    })
    if (!response.ok || !response.body) {
      const detail = await response.text().catch(() => '')
      if ((response.status === 400 && /api key/i.test(detail)) || response.status === 401 || response.status === 403) {
        throw keyRefused('gemini')
      }
      if (response.status === 429) throw geminiFreeLimit()
      if (response.status === 404 || (response.status === 400 && /model/i.test(detail))) throw unknownModel('gemini', model)
      if (response.status >= 500) throw unavailable('gemini')
      throw unexpected('gemini', response.status, detail, TASK)
    }

    let text = ''
    let inputTokens: number | null = null
    let outputTokens: number | null = null
    for await (const event of sseEvents(response.body)) {
      const candidate = (event.candidates as { content?: { parts?: { text?: string; thought?: boolean }[] } }[] | undefined)?.[0]
      const delta = (candidate?.content?.parts ?? [])
        .filter((part) => !part.thought && typeof part.text === 'string')
        .map((part) => part.text)
        .join('')
      if (delta) {
        text += delta
        request.onDelta(delta)
      }
      const usage = event.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined
      if (usage) {
        inputTokens = usage.promptTokenCount ?? inputTokens
        outputTokens = usage.candidatesTokenCount ?? outputTokens
      }
    }
    return { text, model, inputTokens, outputTokens }
  } catch (error) {
    if (isTimeout(error)) throw timeoutError(TASK)
    throw error
  }
}

// ---------------------------------------------------------------------------------------------
// Claude (API Messages, stream: true, bibliothèque officielle)

async function anthropicStream(request: ChatRequest, model: string): Promise<ChatResult> {
  const client = new Anthropic({ apiKey: request.access.apiKey, maxRetries: 1, timeout: request.timeoutMs })
  let text = ''
  let inputTokens: number | null = null
  let outputTokens: number | null = null
  try {
    const stream = await client.messages.create({
      model,
      max_tokens: request.maxOutputTokens,
      system: request.system,
      messages: request.turns.map((turn) => ({ role: turn.role, content: turn.content })),
      stream: true,
    })
    for await (const event of stream) {
      if (event.type === 'message_start') inputTokens = event.message.usage?.input_tokens ?? null
      else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        text += event.delta.text
        request.onDelta(event.delta.text)
      } else if (event.type === 'message_delta') outputTokens = event.usage?.output_tokens ?? outputTokens
    }
    return { text, model, inputTokens, outputTokens }
  } catch (error) {
    if (error instanceof Anthropic.APIConnectionTimeoutError) throw timeoutError(TASK)
    if (!(error instanceof Anthropic.APIError)) throw error
    const status = error.status ?? 0
    const detail = error.message ?? ''
    if (status === 400 && /credit balance|billing/i.test(detail)) throw noCredit('anthropic')
    if (status === 400 && /model/i.test(detail)) throw unknownModel('anthropic', model)
    if (status === 401) throw keyRefused('anthropic')
    if (status === 402) throw noCredit('anthropic')
    if (status === 403) {
      throw new UserFacingError('Votre clé Claude n\'a pas le droit d\'utiliser ce modèle : vérifiez ses droits sur platform.claude.com.')
    }
    if (status === 404) throw unknownModel('anthropic', model)
    if (status === 429) throw tooManyRequests('anthropic')
    if (status === 529 || status >= 500) throw unavailable('anthropic')
    throw unexpected('anthropic', status, detail, TASK)
  }
}
