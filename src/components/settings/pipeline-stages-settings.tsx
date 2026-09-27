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
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { PipelineStage } from '@/types'

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

  const handleDelete = (stage: PipelineStage) => {
    const count = usage[stage.id] ?? 0
    const message =
      count > 0
        ? `Supprimer l'étape « ${stage.name} » ? ${companiesLabel(count)} y ${count > 1 ? 'sont' : 'est'} : elle${count > 1 ? 's' : ''} passera${count > 1 ? 'ont' : ''} « Sans étape », sans être supprimée${count > 1 ? 's' : ''}.`
        : `Supprimer l'étape « ${stage.name} » ?`
    if (!confirm(message)) return
    run(stage.id, () => deleteStage(stage.id), 'Étape supprimée')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle>Étapes du pipeline</CardTitle>
            <CardDescription>
              Le parcours d&apos;une entreprise, dans l&apos;ordre. La nature de chaque étape sert aux
              statistiques (taux de réussite…) : vous pouvez renommer les étapes librement.
            </CardDescription>
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
                  <p className="text-sm text-muted-foreground">{companiesLabel(usage[stage.id] ?? 0)}</p>
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

      {editing && (
        <StageDialog
          stage={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Card>
  )
}

function StageDialog({ stage, onClose }: { stage?: PipelineStage; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [values, setValues] = useState<StageInput>({
    name: stage?.name ?? '',
    color: stage?.color ?? STAGE_COLORS[1] ?? '#3b82f6',
    kind: stage?.kind ?? 'open',
  })
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
                    onChange={() => setValues({ ...values, kind: kind.value })}
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
