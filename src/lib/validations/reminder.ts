import { z } from 'zod'

export const reminderPriorities = ['low', 'medium', 'high'] as const

export type ReminderPriority = (typeof reminderPriorities)[number]

export const reminderPriorityLabels: Record<ReminderPriority, string> = {
  low: 'Faible',
  medium: 'Moyenne',
  high: 'Haute',
}

export const reminderPriorityColors: Record<ReminderPriority, string> = {
  low: 'text-gray-600',
  medium: 'text-blue-600',
  high: 'text-red-600',
}

export const reminderPriorityBadgeVariants: Record<
  ReminderPriority,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  low: 'secondary',
  medium: 'default',
  high: 'destructive',
}

const baseReminderSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  agencyId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  title: z.string().min(1, 'Le titre est requis').max(200).trim(),
  dueAt: z.coerce.date(),
  priority: z.enum(reminderPriorities).default('medium'),
})

// Une relance vise au plus une cible (règle aussi garantie par la base)
const singleTarget = (data: { contactId?: string | null; agencyId?: string | null; companyId?: string | null }) =>
  [data.contactId, data.agencyId, data.companyId].filter(Boolean).length <= 1

const singleTargetMessage = {
  message: 'Une relance ne peut viser qu\'une seule entreprise, agence ou contact',
  path: ['companyId'],
}

export const createReminderSchema = baseReminderSchema.refine(singleTarget, singleTargetMessage)

export const updateReminderSchema = baseReminderSchema.partial().refine(singleTarget, singleTargetMessage)

export type CreateReminderInput = z.infer<typeof createReminderSchema>
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>

// Utilitaires
export function isReminderOverdue(dueAt: Date, completedAt?: Date | null): boolean {
  if (completedAt) return false
  return new Date(dueAt) < new Date()
}

export function isReminderDueToday(dueAt: Date): boolean {
  const today = new Date()
  const due = new Date(dueAt)
  return (
    due.getDate() === today.getDate() &&
    due.getMonth() === today.getMonth() &&
    due.getFullYear() === today.getFullYear()
  )
}

export function isReminderDueThisWeek(dueAt: Date): boolean {
  const today = new Date()
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const due = new Date(dueAt)
  return due >= today && due <= weekFromNow
}

export function getReminderUrgency(
  dueAt: Date,
  priority: ReminderPriority,
  completedAt?: Date | null
): 'overdue' | 'urgent' | 'upcoming' | 'completed' {
  if (completedAt) return 'completed'
  if (isReminderOverdue(dueAt, completedAt)) return 'overdue'
  if (priority === 'high' || isReminderDueToday(dueAt)) return 'urgent'
  return 'upcoming'
}
