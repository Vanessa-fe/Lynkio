// Case unique « Clé de votre IA » : le fournisseur est reconnu d'après la forme de la clé, sans
// l'envoyer nulle part. Une clé n'est donc jamais essayée chez un fournisseur qui n'est pas le sien.
// Fournisseurs du lancement : OpenAI, Google Gemini et Anthropic (Claude).

export type DetectedProvider = 'openai' | 'gemini' | 'anthropic'

export type KeyDetection = { ok: true; provider: DetectedProvider } | { ok: false; reason: 'admin_key' | 'unknown' }

export function detectAiProvider(rawKey: string): KeyDetection {
  const key = rawKey.trim()
  // Clé d'administration Anthropic : elle ne permet pas d'utiliser Claude
  if (key.startsWith('sk-ant-admin')) return { ok: false, reason: 'admin_key' }
  if (key.startsWith('sk-ant-')) return { ok: true, provider: 'anthropic' }
  if (key.startsWith('AIza')) return { ok: true, provider: 'gemini' }
  if (key.startsWith('sk-')) return { ok: true, provider: 'openai' }
  return { ok: false, reason: 'unknown' }
}

export const ADMIN_KEY_MESSAGE =
  'C’est une clé d’administration Anthropic : créez plutôt une clé API classique sur platform.claude.com (Settings > API keys).'
export const UNKNOWN_KEY_MESSAGE =
  'Filonea ne reconnaît pas cette clé : il accepte les clés OpenAI, Gemini et Claude. Vérifiez que vous l’avez copiée en entier.'
