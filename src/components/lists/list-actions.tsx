'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Ellipsis, Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { deleteProspectList, renameProspectList } from '@/lib/actions/prospect-lists'
import { startLinkedinSequences, type StartSummary } from '@/lib/actions/linkedin-sequences'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`
}

// « 3 déjà contactées, 1 sans profil LinkedIn… » : les personnes écartées et pourquoi
function skippedSummary({ skipped }: StartSummary): string | null {
  const parts = [
    skipped.inProgress && plural(skipped.inProgress, 'déjà en cours d\'envoi', 'déjà en cours d\'envoi'),
    skipped.contacted && plural(skipped.contacted, 'déjà contactée', 'déjà contactées'),
    skipped.noLinkedin && plural(skipped.noLinkedin, 'sans profil LinkedIn', 'sans profil LinkedIn'),
    skipped.closed && plural(skipped.closed, 'sur une fiche close', 'sur une fiche close'),
    skipped.optedOut && plural(skipped.optedOut, 'qui ne veut plus être contactée', 'qui ne veulent plus être contactées'),
  ].filter(Boolean)
  return parts.length > 0 ? `Écartées : ${parts.join(', ')}.` : null
}

interface ListActionsProps {
  list: { id: string; name: string }
  // Personnes de la liste qui ont un profil LinkedIn et acceptent d'être contactées
  exportableCount: number
  // Page où aller après la suppression de la liste (sinon : on reste et la page se recharge)
  afterDeleteHref?: string
}

/**
 * Ce qu'on fait d'une liste : l'envoyer sur LinkedIn, l'exporter pour Waalaxy,
 * la renommer, la supprimer. Utilisé sur Personnes (liste affichée) et sur Listes.
 */
export function ListActions({ list, exportableCount, afterDeleteHref }: ListActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isStarting, setIsStarting] = useState(false)

  const startRenaming = () => {
    setNewName(list.name)
    setError(null)
    setIsRenaming(true)
  }

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof renameProspectList>>
    try {
      result = await renameProspectList(list.id, newName)
    } catch {
      setError(CONNECTION_ERROR)
      setIsSaving(false)
      return
    }
    setIsSaving(false)
    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      return
    }
    setIsRenaming(false)
    router.refresh()
  }

  const handleLinkedin = async () => {
    setIsStarting(true)
    let result: Awaited<ReturnType<typeof startLinkedinSequences>>
    try {
      result = await startLinkedinSequences(list.id)
    } catch {
      toast({ variant: 'destructive', title: 'Envoi impossible', description: CONNECTION_ERROR })
      setIsStarting(false)
      return
    }
    setIsStarting(false)
    if (!result.success || !result.data) {
      toast({ variant: 'destructive', title: 'Envoi impossible', description: result.error })
      return
    }
    const { added } = result.data
    const skipped = skippedSummary(result.data)
    if (added === 0) {
      toast({ title: 'Personne de nouveau à envoyer', description: skipped ?? undefined })
      return
    }
    toast({
      title: `${plural(added, 'personne ajoutée', 'personnes ajoutées')} à l'envoi LinkedIn`,
      description: skipped ?? 'Sophie peut maintenant rédiger leurs messages.',
    })
    router.push('/people/linkedin')
  }

  const handleDelete = async () => {
    if (!confirm(`Supprimer la liste « ${list.name} » ? Les personnes restent dans Filonea.`)) return
    let result: Awaited<ReturnType<typeof deleteProspectList>>
    try {
      result = await deleteProspectList(list.id)
    } catch {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: CONNECTION_ERROR })
      return
    }
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: result.error })
      return
    }
    toast({ title: 'Liste supprimée', description: list.name })
    if (afterDeleteHref) router.push(afterDeleteHref)
    router.refresh()
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Gérer la liste ${list.name}`}>
            <Ellipsis className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={startRenaming}>
            <Pencil className="w-4 h-4 mr-2" />
            Renommer la liste
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Supprimer la liste
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {exportableCount > 0 && (
        <Button onClick={handleLinkedin} disabled={isStarting}>
          {isStarting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkedinIcon className="w-4 h-4 mr-2" />}
          Envoyer sur LinkedIn ({exportableCount})
        </Button>
      )}
      {exportableCount > 0 ? (
        <Button variant="outline" asChild>
          <a href={`/api/export/waalaxy?list=${list.id}`} download>
            <Download className="w-4 h-4 mr-2" />
            Exporter pour Waalaxy ({exportableCount})
          </a>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">Aucun profil LinkedIn à exporter</span>
      )}

      <Dialog open={isRenaming} onOpenChange={(value) => !isSaving && setIsRenaming(value)}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleRename} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Renommer la liste</DialogTitle>
            </DialogHeader>
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`rename-list-${list.id}`}>Nom</Label>
              <Input
                id={`rename-list-${list.id}`}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                maxLength={100}
                disabled={isSaving}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRenaming(false)} disabled={isSaving}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving || !newName.trim()}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Renommer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
