import { z } from 'zod'

/**
 * Schémas de validation pour le profil utilisateur
 */

export const onboardingSchema = z.object({
  firstName: z
    .string()
    .min(1, 'Le prénom est requis')
    .max(50, 'Le prénom est trop long'),
  businessName: z
    .string()
    .min(1, 'Le nom de l\'activité est requis')
    .max(100, 'Le nom de l\'activité est trop long'),
  // Clé d'une ligne de la table professions ; la clé étrangère vérifie qu'elle existe
  professionKey: z
    .string({ required_error: 'Choisissez votre métier' })
    .regex(/^[a-z][a-z0-9_]*$/, 'Choisissez votre métier'),
  selectedTheme: z
    .string()
    .min(1, 'Le thème est requis')
    .refine(
      (theme) =>
        ['minimal', 'pink-candy', 'dark-violet', 'sage', 'ocean', 'sunset'].includes(theme),
      'Le thème sélectionné n\'est pas valide'
    ),
})

export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .max(50, 'Le prénom est trop long')
    .optional(),
  businessName: z
    .string()
    .max(100, 'Le nom de l\'activité est trop long')
    .optional(),
  avatarUrl: z
    .string()
    .url('L\'URL de l\'avatar n\'est pas valide')
    .optional()
    .nullable(),
  selectedTheme: z
    .string()
    .refine(
      (theme) =>
        ['minimal', 'pink-candy', 'dark-violet', 'sage', 'ocean', 'sunset'].includes(theme),
      'Le thème sélectionné n\'est pas valide'
    )
    .optional(),
})

/**
 * Ce que Sophie sait de l'utilisateur pour rédiger ses messages
 */
export const messageSettingsSchema = z.object({
  pitch: z
    .string()
    .trim()
    .max(1500, 'La présentation est trop longue (1 500 caractères au plus)')
    // Déjà transformé en null côté navigateur : le serveur revalide la même valeur
    .nullable()
    .optional()
    .transform((value) => value || null),
  signature: z
    .string()
    .trim()
    .max(500, 'La signature est trop longue (500 caractères au plus)')
    .nullable()
    .optional()
    .transform((value) => value || null),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type MessageSettingsInput = z.input<typeof messageSettingsSchema>
