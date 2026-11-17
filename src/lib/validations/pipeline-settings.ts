import { z } from 'zod'
import type { PipelineStageKind } from '@/types'
import { roleFitsKind, STAGE_ROLES, type StageRole } from '@/lib/stage-meaning'

/**
 * Réglages du pipeline : étapes et sources des entreprises
 */

export const STAGE_KINDS: { value: PipelineStageKind; label: string; description: string }[] = [
  { value: 'open', label: 'En cours', description: 'La prospection continue' },
  { value: 'won', label: 'Signé', description: 'Mission obtenue' },
  { value: 'lost', label: 'Non concrétisé', description: 'L\'entreprise a dit non, ou rien n\'a abouti' },
  { value: 'excluded', label: 'Hors cible', description: 'Ne correspond pas à ce que vous cherchez' },
]

export const stageKindLabels = Object.fromEntries(STAGE_KINDS.map((kind) => [kind.value, kind.label])) as Record<
  PipelineStageKind,
  string
>

// Couleurs proposées (contraste suffisant sur fond clair et sombre)
export const STAGE_COLORS = [
  '#64748b',
  '#3b82f6',
  '#06b6d4',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#f97316',
  '#22c55e',
  '#ef4444',
  '#6b7280',
]

// Source utilisée par Sophie pour étiqueter ce qu'elle trouve (recherchée par son nom)
export const AUTOMATIC_SOURCE_NAME = 'Détection automatique'

export const stageSchema = z
  .object({
    name: z.string().trim().min(1, 'Le nom est requis').max(50, 'Le nom est trop long'),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Choisissez une couleur'),
    kind: z.enum(['open', 'won', 'lost', 'excluded'], { error: 'Choisissez la nature de l\'étape' }),
    // Ce que représente l'étape (facultatif) : Sophie et les statistiques la comprennent quel que soit son nom
    role: z.enum(STAGE_ROLES.map((role) => role.value) as [StageRole, ...StageRole[]]).nullable().optional(),
  })
  .refine((stage) => roleFitsKind(stage.kind, stage.role ?? null), {
    message: 'Ce rôle ne correspond pas à la nature de l\'étape',
    path: ['role'],
  })

export type StageInput = z.input<typeof stageSchema>

export const sourceSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(50, 'Le nom est trop long'),
})

export type SourceInput = z.input<typeof sourceSchema>
