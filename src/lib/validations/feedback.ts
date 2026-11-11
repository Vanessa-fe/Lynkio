import { z } from 'zod'

export const FEEDBACK_KINDS = [
  { value: 'idea', label: 'Une idée de fonction' },
  { value: 'improvement', label: 'Un point à améliorer' },
  { value: 'problem', label: 'Un problème' },
  { value: 'other', label: 'Autre chose' },
] as const

export const feedbackSchema = z.object({
  kind: z.enum(['idea', 'improvement', 'problem', 'other']),
  message: z
    .string()
    .trim()
    .min(5, 'Écrivez quelques mots de plus')
    .max(2000, 'Message trop long (2 000 caractères au plus)'),
  page: z
    .string()
    .max(200)
    .regex(/^\/[\w\-/]*$/)
    .optional()
    .nullable(),
})

export type FeedbackInput = z.input<typeof feedbackSchema>
