'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToastAction } from '@/components/ui/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { addContactsToList } from '@/lib/actions/prospect-lists'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { ProspectListWithCount } from '@/lib/queries/people'

interface AddToListDialogProps {
  contactIds: string[]
  lists: ProspectListWithCount[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

// Choix « Nouvelle liste… » du menu
const NEW_LIST = '__new__'

/**
 * Ajoute les personnes cochées à une liste existante, choisie dans le menu, ou à une
 * nouvelle liste créée à partir du nom tapé
 */
export function AddToListDialog({ contactIds, lists, open, onOpenChange, onDone }: AddToListDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [choice, setChoice] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Sans liste existante, on crée forcément une nouvelle liste
  const creating = lists.length === 0 || choice === NEW_LIST
  const trimmed = name.trim()
  const existing = creating
    ? trimmed
      ? lists.find((list) => list.name.toLowerCase() === trimmed.toLowerCase())
      : undefined
    : lists.find((list) => list.id === choice)
  const canSubmit = creating ? trimmed !== '' : existing !== undefined
  const count = contactIds.length

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof addContactsToList>>
    try {
      result = await addContactsToList(existing ? { listId: existing.id } : { listName: trimmed }, contactIds)
    } catch {
      setError(CONNECTION_ERROR)
      setIsSaving(false)
      return
    }
    setIsSaving(false)

    if (!result.success || !result.data) {
      setError(result.error || 'Une erreur est survenue')
      return
    }

    const { added, listId } = result.data
    const already = count - added
    toast({
      title: `${added} personne${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} à « ${existing?.name ?? trimmed} »`,
      description: already > 0 ? `${already} y étai${already > 1 ? 'en' : ''}t déjà.` : undefined,
      action: (
        <ToastAction altText="Voir la liste" onClick={() => router.push(`/people?list=${listId}`)}>
          Voir la liste
        </ToastAction>
      ),
    })
    setName('')
    setChoice('')
    onOpenChange(false)
    onDone()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !isSaving && onOpenChange(value)}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              Ajouter {count} personne{count > 1 ? 's' : ''} à une liste
            </DialogTitle>
            <DialogDescription>
              Choisissez une de vos listes, ou créez-en une nouvelle. Une personne peut être dans plusieurs listes.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}

          {lists.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="list-choice">Liste</Label>
              <Select value={choice} onValueChange={setChoice} disabled={isSaving}>
                <SelectTrigger id="list-choice">
                  <SelectValue placeholder="Choisir une liste" />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name} ({list.count})
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NEW_LIST}>+ Nouvelle liste…</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {creating && (
            <div className="space-y-2">
              <Label htmlFor="list-name">{lists.length > 0 ? 'Nom de la nouvelle liste' : 'Nom de la liste'}</Label>
              <Input
                id="list-name"
                autoComplete="off"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Agences Lyon, Session du lundi..."
                maxLength={100}
                disabled={isSaving}
                autoFocus
              />
              {existing && (
                <p className="text-sm text-muted-foreground">
                  Cette liste existe déjà ({existing.count} personne{existing.count > 1 ? 's' : ''}) : les personnes y
                  seront ajoutées.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving || !canSubmit}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
