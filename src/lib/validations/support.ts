import { z } from 'zod'

export const SUPPORT_TOPICS = [
  { value: 'question', label: 'Une question sur Filonea' },
  { value: 'problem', label: 'Un problème, un bug' },
  { value: 'account', label: 'Mon compte, la connexion' },
  { value: 'billing', label: 'Abonnement et facturation' },
  { value: 'other', label: 'Autre chose' },
] as const

export const supportSchema = z.object({
  name: z.string().trim().min(1, 'Indiquez votre prénom ou votre nom').max(100, 'Nom trop long'),
  email: z.string().trim().email('Adresse e-mail invalide').max(254),
  topic: z.enum(['question', 'problem', 'account', 'billing', 'other']),
  message: z
    .string()
    .trim()
    .min(10, 'Décrivez votre demande en quelques mots de plus')
    .max(4000, 'Message trop long (4 000 caractères au plus)'),
  // Champ caché : un robot le remplit, une personne ne le voit pas
  website: z.string().max(200).optional(),
  // Moment où le formulaire s'est affiché : envoyé en moins de 3 secondes, c'est un robot
  startedAt: z.number().int().optional(),
})

export type SupportInput = z.input<typeof supportSchema>
