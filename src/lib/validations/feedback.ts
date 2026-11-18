import { z } from 'zod'

export const FEEDBACK_KINDS = [
  { value: 'idea', label: 'Une idée de fonction' },
  { value: 'improvement', label: 'Un point à améliorer' },
  { value: 'other', label: 'Autre chose' },
] as const

// Ancien choix « Un problème », passé au formulaire d'aide : gardé pour afficher les anciens messages
export const FEEDBACK_KIND_LABELS: Record<string, string> = {
  ...Object.fromEntries(FEEDBACK_KINDS.map((kind) => [kind.value, kind.label])),
  problem: 'Un problème',
}

export const feedbackSchema = z.object({
  kind: z.enum(['idea', 'improvement', 'other']),
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
