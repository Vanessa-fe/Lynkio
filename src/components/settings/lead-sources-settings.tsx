'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { createSource, deleteSource, moveSource, updateSource } from '@/lib/actions/pipeline-settings'
import { AUTOMATIC_SOURCE_NAME } from '@/lib/validations/pipeline-settings'
import { useToast } from '@/lib/hooks/use-toast'
import type { LeadSource } from '@/types'

interface LeadSourcesSettingsProps {
  sources: LeadSource[]
  usage: Record<string, number>
}

function companiesLabel(count: number) {
  return count === 0 ? 'aucune entreprise' : `${count} entreprise${count > 1 ? 's' : ''}`
}

export function LeadSourcesSettings({ sources, usage }: LeadSourcesSettingsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<LeadSource | 'new' | null>(null)

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

  const handleDelete = (source: LeadSource) => {
    const count = usage[source.id] ?? 0
    const message =
      count > 0
        ? `Supprimer la source « ${source.name} » ? ${companiesLabel(count)} ${count > 1 ? 'la citent' : 'la cite'} : ${count > 1 ? 'elles restent' : 'elle reste'} dans vos entreprises, sans source.`
        : `Supprimer la source « ${source.name} » ?`
    if (!confirm(message)) return
    run(source.id, () => deleteSource(source.id), 'Source supprimée')
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <CardTitle>Sources</CardTitle>
            <CardDescription>D&apos;où viennent vos entreprises : utile pour savoir ce qui marche le mieux.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setEditing('new')} className="shrink-0">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une source
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="divide-y">
          {sources.map((source, index) => {
            const isAutomatic = source.name === AUTOMATIC_SOURCE_NAME

            return (
              <li key={source.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{source.name}</span>
                    {isAutomatic && (
                      <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-label="Utilisée par Sophie" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {isAutomatic ? 'Ce que Sophie trouve · ' : ''}
                    {companiesLabel(usage[source.id] ?? 0)}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(source.id, () => moveSource(source.id, 'up'))}
                    disabled={index === 0 || busyId !== null}
                    aria-label={`Monter ${source.name}`}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(source.id, () => moveSource(source.id, 'down'))}
                    disabled={index === sources.length - 1 || busyId !== null}
                    aria-label={`Descendre ${source.name}`}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(source)}
                    disabled={isAutomatic || busyId !== null}
                    aria-label={`Renommer ${source.name}`}
                    title={isAutomatic ? 'Utilisée par Sophie : ne peut pas être renommée' : undefined}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(source)}
                    disabled={isAutomatic || busyId !== null}
                    aria-label={`Supprimer ${source.name}`}
                    title={isAutomatic ? 'Utilisée par Sophie : ne peut pas être supprimée' : undefined}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>

      {editing && (
        <SourceDialog source={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />
      )}
    </Card>
  )
}

function SourceDialog({ source, onClose }: { source?: LeadSource; onClose: () => void }) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState(source?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    const result = source ? await updateSource(source.id, { name }) : await createSource({ name })
    setIsSaving(false)

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      return
    }

    toast({ title: source ? 'Source renommée' : 'Source ajoutée' })
    onClose()
    router.refresh()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{source ? 'Renommer la source' : 'Nouvelle source'}</DialogTitle>
          <DialogDescription>Par exemple : Malt, salon, bouche-à-oreille…</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="sourceName">Nom</Label>
            <Input
              id="sourceName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : source ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
