import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { ApiKeyProvider } from '@/lib/constants/api-keys'

const TIMEOUT_MS = 10_000

// warning : la clé est bonne, mais quelque chose est à savoir (recherche sur Internet impossible…)
export type KeyCheck = { ok: true; warning?: string } | { ok: false; error: string }

const noWebSearch = (model: string) =>
  `Clé enregistrée, mais le modèle « ${model} » ne permet pas la recherche sur Internet : la recherche par technologie ne marchera pas. Laissez le champ Modèle vide pour le modèle conseillé.`

/**
 * Vérifie une clé auprès de son service avant de l'enregistrer, sans rien dépenser :
 * lecture de la fiche du modèle (OpenAI, Gemini, Claude) ou du compte (Hunter).
 */
export async function checkApiKey(provider: ApiKeyProvider, key: string, model: string | null): Promise<KeyCheck> {
  try {
    if (provider === 'openai') return await checkOpenAi(key, model ?? '')
    if (provider === 'gemini') return await checkGemini(key, model ?? '')
    if (provider === 'anthropic') return await checkAnthropic(key, model ?? '')
    return await checkHunter(key)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { ok: false, error: 'Le service n\'a pas répondu à temps : réessayez dans un instant.' }
    }
    throw error
  }
}

async function checkOpenAi(key: string, model: string): Promise<KeyCheck> {
  const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (response.ok) {
    // Pas de recherche sur Internet avec les modèles « nano » (documentation OpenAI, 11/11/2026)
    return /nano/i.test(model) ? { ok: true, warning: noWebSearch(model) } : { ok: true }
  }
  if (response.status === 401) return { ok: false, error: 'OpenAI refuse cette clé : vérifiez que vous l\'avez copiée en entier.' }
  if (response.status === 403) {
    return { ok: false, error: 'Cette clé n\'a pas accès aux modèles : donnez-lui l\'accès complet (« All ») sur OpenAI.' }
  }
  if (response.status === 404) {
    return { ok: false, error: `Le modèle « ${model} » n'est pas disponible avec cette clé : laissez le champ Modèle vide.` }
  }
  if (response.status === 429) return { ok: false, error: 'OpenAI reçoit trop de demandes : réessayez dans un instant.' }
  return { ok: false, error: `OpenAI n'a pas pu vérifier la clé (erreur ${response.status}) : réessayez plus tard.` }
}

async function checkGemini(key: string, model: string): Promise<KeyCheck> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, {
    // La clé dans l'en-tête, jamais dans l'adresse
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (response.ok) {
    if (/gemma/i.test(model)) return { ok: true, warning: noWebSearch(model) }
    // L'offre gratuite de Google ne comprend pas la recherche sur Internet
    return {
      ok: true,
      warning: 'Bon à savoir : pour la recherche par technologie, Gemini demande d\'activer la facturation dans Google AI Studio.',
    }
  }
  // Clé invalide : Google répond 400 « API key not valid »
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    return { ok: false, error: 'Google refuse cette clé : vérifiez que vous l\'avez copiée en entier.' }
  }
  if (response.status === 404) {
    return { ok: false, error: `Le modèle « ${model} » n'est pas disponible avec cette clé : laissez le champ Modèle vide.` }
  }
  if (response.status === 429) return { ok: false, error: 'Google reçoit trop de demandes : réessayez dans un instant.' }
  return { ok: false, error: `Google n'a pas pu vérifier la clé (erreur ${response.status}) : réessayez plus tard.` }
}

// Fiche du modèle chez Anthropic (gratuit) : vérifie la clé et dit si le modèle sait chercher sur Internet
async function checkAnthropic(key: string, model: string): Promise<KeyCheck> {
  const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: TIMEOUT_MS })
  try {
    const info = (await client.models.retrieve(model)) as {
      capabilities?: { server_tools?: { web_search?: { supported?: boolean } } }
    }
    return info.capabilities?.server_tools?.web_search?.supported === false ? { ok: true, warning: noWebSearch(model) } : { ok: true }
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: 'Anthropic refuse cette clé : vérifiez que vous l\'avez copiée en entier.' }
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return { ok: false, error: 'Cette clé n\'a pas le droit d\'utiliser Claude : vérifiez ses droits sur platform.claude.com.' }
    }
    if (error instanceof Anthropic.NotFoundError) {
      return { ok: false, error: `Le modèle « ${model} » n'est pas disponible avec cette clé : laissez le champ Modèle vide.` }
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: 'Anthropic reçoit trop de demandes : réessayez dans un instant.' }
    }
    if (error instanceof Anthropic.APIConnectionTimeoutError) {
      return { ok: false, error: 'Le service n\'a pas répondu à temps : réessayez dans un instant.' }
    }
    if (error instanceof Anthropic.APIError) {
      return { ok: false, error: `Anthropic n'a pas pu vérifier la clé (erreur ${error.status ?? '?'}) : réessayez plus tard.` }
    }
    throw error
  }
}

async function checkHunter(key: string): Promise<KeyCheck> {
  const response = await fetch('https://api.hunter.io/v2/account', {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (response.ok) return { ok: true }
  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: 'Hunter refuse cette clé : vérifiez que vous l\'avez copiée en entier.' }
  }
  if (response.status === 429) return { ok: false, error: 'Hunter reçoit trop de demandes : réessayez dans un instant.' }
  return { ok: false, error: `Hunter n'a pas pu vérifier la clé (erreur ${response.status}) : réessayez plus tard.` }
}
