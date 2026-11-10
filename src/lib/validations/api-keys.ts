import { z } from 'zod'

export const apiKeySchema = z.object({
  provider: z.enum(['openai', 'hunter']),
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
