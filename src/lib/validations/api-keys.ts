import { z } from 'zod'
import { isSafeApiBaseUrl } from '@/lib/url-safety'

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

export const customAiKeySchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .max(200, 'Adresse trop longue')
    .transform((url) => url.replace(/\/+$/, ''))
    .refine(isSafeApiBaseUrl, 'Adresse invalide : elle doit commencer par https:// et viser le service (ex. https://api.mistral.ai/v1)'),
  model: z
    .string()
    .trim()
    .min(1, 'Indiquez le modèle à utiliser')
    .max(80, 'Nom de modèle trop long')
    .regex(/^[\w.:/-]+$/, 'Nom de modèle invalide'),
  key: z
    .string()
    .trim()
    .min(16, 'Cette clé est trop courte : copiez-la en entier')
    .max(400, 'Cette clé est trop longue')
    .regex(/^\S+$/, 'La clé ne doit pas contenir d\'espace'),
})

export type CustomAiKeyInput = z.input<typeof customAiKeySchema>
