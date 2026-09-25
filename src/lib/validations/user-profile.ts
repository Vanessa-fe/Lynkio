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
  businessType: z
    .string()
    .max(100, 'Le type d\'activité est trop long')
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

export type OnboardingInput = z.infer<typeof onboardingSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
