import { z } from 'zod'
import { isSafeApiBaseUrl } from '@/lib/url-safety'
import { AI_SERVICE_KEYS } from '@/lib/ai-key-detection'

export const apiKeySchema = z.object({
  provider: z.enum(['openai', 'gemini', 'hunter']),
  key: z
    .string()
    .trim()
    .min(16, 'Cette clé est trop courte : copiez-la en entier')
    .max(400, 'Cette clé est trop longue')
    .regex(/^\S+$/, 'La clé ne doit pas contenir d\'espace'),
  // Vide = modèle conseillé
  model: z
    .string()
    .trim()
    .max(80, 'Nom de modèle trop long')
    .regex(/^[\w.:-]*$/, 'Nom de modèle invalide')
    .optional()
    .transform((model) => model || null),
})

export type ApiKeyInput = z.input<typeof apiKeySchema>

export const aiProviderSchema = z.enum(['openai', 'gemini', 'custom'])

// Case unique « Clé de votre IA » : service reconnu d'après la clé (« auto ») ou choisi
export const aiKeySchema = z.object({
  key: z
    .string()
    .trim()
    .min(16, 'Cette clé est trop courte : copiez-la en entier')
    .max(400, 'Cette clé est trop longue')
    .regex(/^\S+$/, 'La clé ne doit pas contenir d\'espace'),
  service: z.enum(['auto', ...AI_SERVICE_KEYS, 'other']).default('auto'),
  // Vide = modèle conseillé
  model: z
    .string()
    .trim()
    .max(80, 'Nom de modèle trop long')
    .regex(/^[\w.:/-]*$/, 'Nom de modèle invalide')
    .optional()
    .transform((model) => model || null),
  // « Autre service compatible OpenAI » seulement
  baseUrl: z
    .string()
    .trim()
    .max(200, 'Adresse trop longue')
    .optional()
    .transform((url) => (url ? url.replace(/\/+$/, '') : null))
    .refine(
      (url) => url === null || isSafeApiBaseUrl(url),
      'Adresse invalide : elle doit commencer par https:// et viser le service (ex. https://api.mistral.ai/v1)'
    ),
})

export type AiKeyInput = z.input<typeof aiKeySchema>
