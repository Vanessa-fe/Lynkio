// Case unique « Clé de votre IA » : le service est reconnu d'après la forme de la clé, sans
// l'envoyer nulle part. Une clé n'est donc jamais essayée chez un service qui n'est pas le sien.

export const AI_SERVICE_KEYS = ['openai', 'gemini', 'mistral', 'deepseek', 'groq', 'openrouter', 'xai'] as const
export type AiServiceKey = (typeof AI_SERVICE_KEYS)[number]

export type KeyDetection = { ok: true; service: AiServiceKey } | { ok: false; reason: 'anthropic' | 'unknown' }

export function detectAiService(rawKey: string): KeyDetection {
  const key = rawKey.trim()
  // Claude n'est pas encore branché en direct (pas de vraie clé pour le tester)
  if (key.startsWith('sk-ant-')) return { ok: false, reason: 'anthropic' }
  if (key.startsWith('sk-or-')) return { ok: true, service: 'openrouter' }
  if (key.startsWith('gsk_')) return { ok: true, service: 'groq' }
  if (key.startsWith('xai-')) return { ok: true, service: 'xai' }
  if (key.startsWith('AIza')) return { ok: true, service: 'gemini' }
  // DeepSeek : « sk- » suivi de 32 caractères hexadécimaux ; OpenAI : tous les autres « sk-… »
  if (/^sk-[0-9a-f]{32}$/.test(key)) return { ok: true, service: 'deepseek' }
  if (key.startsWith('sk-')) return { ok: true, service: 'openai' }
  // Mistral : 32 lettres et chiffres, sans préfixe
  if (/^[A-Za-z0-9]{32}$/.test(key)) return { ok: true, service: 'mistral' }
  return { ok: false, reason: 'unknown' }
}

export const CLAUDE_KEY_MESSAGE =
  'Claude (Anthropic) n’est pas encore branché en direct : créez une clé OpenRouter, qui donne accès à Claude, et collez-la ici.'
export const UNKNOWN_KEY_MESSAGE =
  'Filonea ne reconnaît pas cette clé : vérifiez que vous l’avez copiée en entier, ou choisissez le service vous-même ci-dessous.'

/**
 * Modèle conseillé quand le service n'en a pas de stable : le premier de sa liste qui correspond à
 * une préférence, en essayant les préférences dans l'ordre (version la plus récente d'abord).
 */
export function pickModel(ids: string[], preferences: string[]): string | null {
  const newestFirst = [...ids].sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
  for (const preference of preferences) {
    const pattern = new RegExp(preference)
    const match = newestFirst.find((id) => pattern.test(id))
    if (match) return match
  }
  return null
}
