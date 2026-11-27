import { z } from 'zod'
import { searchKeywordsSchema } from './icp'
import { strategySchema } from './strategy'

/**
 * Schémas de validation pour le profil utilisateur
 */

export const onboardingSchema = z.object({
  // Prénom utilisé dans les e-mails (« Bonjour Marie ») : obligatoire, sans espaces seuls
  firstName: z
    .string()
    .trim()
    .min(1, 'Le prénom est requis')
    .max(50, 'Le prénom est trop long'),
  businessName: z
    .string()
    .trim()
    .min(1, 'Le nom de l\'activité est requis')
    .max(100, 'Le nom de l\'activité est trop long'),
  // Clé d'une ligne de la table professions ; la clé étrangère vérifie qu'elle existe
  professionKey: z
    .string({ error: 'Choisissez votre métier' })
    .regex(/^[a-z][a-z0-9_]*$/, 'Choisissez votre métier'),
  // Mots-clés de recherche des offres d'emploi (arrêtées le 13/11/2026), rangés dans le premier client idéal
  searchKeywords: searchKeywordsSchema.optional(),
  // Première recherche par profil : Sophie a quelque chose à chercher dès le premier jour
  firstSearch: strategySchema.pick({ approach: true, sectorGroups: true, departments: true }).optional(),
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
  // Modifiable, mais jamais effacé : il sert dans les e-mails
  firstName: z
    .string()
    .trim()
    .min(1, 'Le prénom est requis')
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
  // Plafond de messages WhatsApp par jour (offre Pro) ; absent : inchangé
  whatsappDailyLimit: z
    .number({ error: 'Indiquez un nombre entre 1 et 50' })
    .int('Indiquez un nombre entier')
    .min(1, 'Au moins 1 message par jour')
    .max(50, 'Au plus 50 messages par jour')
    .optional(),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type MessageSettingsInput = z.input<typeof messageSettingsSchema>
