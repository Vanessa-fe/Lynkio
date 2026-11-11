import 'server-only'
import type { ApiKeyProvider } from '@/lib/constants/api-keys'

const TIMEOUT_MS = 10_000

export type KeyCheck = { ok: true } | { ok: false; error: string }

/**
 * Vérifie une clé auprès de son service avant de l'enregistrer, sans rien dépenser :
 * lecture de la fiche du modèle (OpenAI) ou du compte (Hunter).
 */
export async function checkApiKey(provider: ApiKeyProvider, key: string, model: string | null): Promise<KeyCheck> {
  try {
    if (provider === 'openai') return await checkOpenAi(key, model ?? '')
    if (provider === 'gemini') return await checkGemini(key, model ?? '')
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
  if (response.ok) return { ok: true }
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
  if (response.ok) return { ok: true }
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
