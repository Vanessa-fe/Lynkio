'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  createStage,
  deleteStage,
  moveStage,
  setDefaultStage,
  updateStage,
} from '@/lib/actions/pipeline-settings'
import { STAGE_COLORS, STAGE_KINDS, stageKindLabels, type StageInput } from '@/lib/validations/pipeline-settings'
import { rolesForKind, roleFitsKind, STAGE_ROLES } from '@/lib/stage-meaning'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types'
import { confirmAction } from '@/components/ui/confirm-dialog'

interface PipelineStagesSettingsProps {
  stages: PipelineStage[]
  usage: Record<string, number>
}

function companiesLabel(count: number) {
  return count === 0 ? 'aucune entreprise' : `${count} entreprise${count > 1 ? 's' : ''}`
}

export function PipelineStagesSettings({ stages, usage }: PipelineStagesSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<PipelineStage | 'new' | null>(null)

  const run = async (id: string, action: () => Promise<{ success: boolean; error?: string }>, success?: string) => {
    setBusyId(id)
    const result = await action()
    setBusyId(null)

    if (result.success) {
      if (success) toast({ title: success })
      router.refresh()
    } else {
      toast({ variant: 'destructive', title: 'Action impossible', description: result.error })
    }
  }

  const [deleting, setDeleting] = useState<PipelineStage | null>(null)

  // Étape vide : une simple confirmation ; sinon, on choisit où vont ses entreprises
  const handleDelete = async (stage: PipelineStage) => {
    if ((usage[stage.id] ?? 0) > 0) {
      setDeleting(stage)
      return
    }
    const confirmed = await confirmAction({ title: `Supprimer l'étape « ${stage.name} » ?`, confirmLabel: 'Supprimer', destructive: true })
    if (!confirmed) return
    run(stage.id, () => deleteStage(stage.id), 'Étape supprimée')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle>Étapes du pipeline</CardTitle>
            <CardDescription>Renommez-les librement.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing('new')} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une étape
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {stages.map((stage, index) => (
            <li key={stage.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color }} aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{stage.name}</span>
                    <Badge variant="outline">{stageKindLabels[stage.kind]}</Badge>
                    {stage.is_default && <Badge>Nouvelles entreprises</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {companiesLabel(usage[stage.id] ?? 0)}
                    {/* Rien à préciser quand le nom dit déjà la même chose (« Rendez-vous ») */}
                    {roleLabel(stage) &&
                      roleLabel(stage)!.toLowerCase() !== stage.name.trim().toLowerCase() &&
                      ` · correspond à « ${roleLabel(stage)} »`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => run(stage.id, () => moveStage(stage.id, 'up'))}
                  disabled={index === 0 || busyId !== null}
                  aria-label={`Monter ${stage.name}`}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => run(stage.id, () => moveStage(stage.id, 'down'))}
                  disabled={index === stages.length - 1 || busyId !== null}
                  aria-label={`Descendre ${stage.name}`}
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                {!stage.is_default && stage.kind === 'open' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      run(stage.id, () => setDefaultStage(stage.id), `Les nouvelles entreprises arriveront dans « ${stage.name} »`)
                    }
                    disabled={busyId !== null}
                    aria-label={`Faire arriver les nouvelles entreprises dans ${stage.name}`}
                    title="Y faire arriver les nouvelles entreprises"
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(stage)}
                  disabled={busyId !== null}
                  aria-label={`Modifier ${stage.name}`}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(stage)}
                  disabled={stage.is_default || busyId !== null}
                  aria-label={`Supprimer ${stage.name}`}
                  title={stage.is_default ? 'Choisissez d\'abord une autre étape pour les nouvelles entreprises' : undefined}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground mt-4 flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5" aria-hidden="true" />
          choisit l&apos;étape où arrivent les entreprises que vous ajoutez et celles trouvées par Sophie.
        </p>
      </CardContent>

      {deleting && (
        <DeleteStageDialog
          stage={deleting}
          stages={stages}
          count={usage[deleting.id] ?? 0}
          busy={busyId !== null}
          onCancel={() => setDeleting(null)}
          onConfirm={(moveTo) => {
            const stage = deleting
            setDeleting(null)
            run(stage.id, () => deleteStage(stage.id, moveTo), 'Étape supprimée')
          }}
        />
      )}

      {editing && (
        <StageDialog
          stage={editing === 'new' ? undefined : editing}
          stages={stages}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

// Suppression d'une étape qui contient des entreprises : elles vont dans l'étape choisie
// (par défaut celle d'avant, comme « Contacté » pour « Relancé »), ou « Sans étape »
function DeleteStageDialog({
  stage,
  stages,
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  stage: PipelineStage
  stages: PipelineStage[]
  count: number
  busy: boolean
  onCancel: () => void
  onConfirm: (moveTo: string | null) => void
}) {
  const others = stages.filter((other) => other.id !== stage.id)
  const index = stages.findIndex((other) => other.id === stage.id)
  const suggested = stages[index - 1] ?? stages[index + 1] ?? null
  const [moveTo, setMoveTo] = useState<string>(suggested?.id ?? NO_STAGE)

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer « {stage.name} » ?</DialogTitle>
          <DialogDescription>
            {companiesLabel(count)} y {count > 1 ? 'sont' : 'est'}. Elle{count > 1 ? 's' : ''} ne{' '}
            {count > 1 ? 'seront' : 'sera'} pas supprimée{count > 1 ? 's' : ''} : choisissez où {count > 1 ? 'les' : 'la'}{' '}
            déplacer. Leurs échanges et leur historique sont gardés.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="moveTo">Déplacer vers</Label>
          <Select value={moveTo} onValueChange={setMoveTo} disabled={busy}>
            <SelectTrigger id="moveTo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {others.map((other) => (
                <SelectItem key={other.id} value={other.id}>
                  {other.name}
                </SelectItem>
              ))}
              <SelectItem value={NO_STAGE}>Sans étape</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button type="button" variant="destructive" onClick={() => onConfirm(moveTo === NO_STAGE ? null : moveTo)} disabled={busy}>
            Supprimer l&apos;étape
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const NO_STAGE = 'none'

// Ce à quoi correspond l'étape (rôle), quand il est connu et cohérent avec sa nature
function roleLabel(stage: PipelineStage): string | null {
  if (!stage.role || !roleFitsKind(stage.kind, stage.role)) return null
  return STAGE_ROLES.find((role) => role.value === stage.role)?.label ?? null
}

const NO_ROLE = 'none'

function StageDialog({ stage, stages, onClose }: { stage?: PipelineStage; stages: PipelineStage[]; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [values, setValues] = useState<StageInput>({
    name: stage?.name ?? '',
    color: stage?.color ?? STAGE_COLORS[1] ?? '#3b82f6',
    kind: stage?.kind ?? 'open',
    role: stage?.role ?? null,
  })
  // Rôles déjà portés par une autre étape du compte (un seul par compte)
  const takenBy = new Map(
    stages.filter((other) => other.id !== stage?.id && other.role).map((other) => [other.role as string, other.name])
  )
  const roleOptions = rolesForKind(values.kind)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    const result = stage ? await updateStage(stage.id, values) : await createStage(values)
    setIsSaving(false)

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      return
    }

    toast({ title: stage ? 'Étape modifiée' : 'Étape ajoutée' })
    onClose()
    router.refresh()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{stage ? 'Modifier l\'étape' : 'Nouvelle étape'}</DialogTitle>
          <DialogDescription>
            {stage ? 'Les entreprises à cette étape y restent.' : 'Elle s\'ajoute à la fin du pipeline.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="stageName">Nom</Label>
            <Input
              id="stageName"
              value={values.name}
              onChange={(event) => setValues({ ...values, name: event.target.value })}
              placeholder="Ex. : Devis envoyé"
              disabled={isSaving}
              autoFocus
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">Couleur</legend>
            <div className="flex flex-wrap gap-2">
              {STAGE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValues({ ...values, color })}
                  aria-label={`Couleur ${color}`}
                  aria-pressed={values.color === color}
                  disabled={isSaving}
                  className={cn(
                    'w-8 h-8 rounded-full border-2 transition-transform',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    values.color === color ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium mb-2">Nature</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {STAGE_KINDS.map((kind) => (
                <label
                  key={kind.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-2 rounded-md border p-3 text-sm',
                    'has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring'
                  )}
                >
                  <input
                    type="radio"
                    name="stageKind"
                    value={kind.value}
                    checked={values.kind === kind.value}
                    // Un rôle qui ne convient plus à la nouvelle nature est retiré
                    onChange={() =>
                      setValues({
                        ...values,
                        kind: kind.value,
                        role: roleFitsKind(kind.value, values.role ?? null) ? values.role : null,
                      })
                    }
                    disabled={isSaving}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    <span className="font-medium block">{kind.label}</span>
                    <span className="text-muted-foreground">{kind.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {roleOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="stageRole">Cette étape correspond à…</Label>
              <Select
                value={values.role ?? NO_ROLE}
                onValueChange={(value) => setValues({ ...values, role: value === NO_ROLE ? null : (value as StageInput['role']) })}
                disabled={isSaving}
              >
                <SelectTrigger id="stageRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROLE}>Rien de particulier</SelectItem>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value} disabled={takenBy.has(role.value)}>
                      {role.label}
                      {takenBy.has(role.value) ? ` (déjà : ${takenBy.get(role.value)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {(values.role && roleOptions.find((role) => role.value === values.role)?.hint) ||
                  'Facultatif. Sophie et les statistiques comprennent ainsi l’étape, quel que soit son nom.'}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : stage ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
