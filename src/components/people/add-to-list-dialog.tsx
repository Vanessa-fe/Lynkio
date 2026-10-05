'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

/**
 * Ajoute les personnes cochées à une liste existante, ou à une nouvelle liste
 * créée à partir du nom tapé
 */
export function AddToListDialog({ contactIds, lists, open, onOpenChange, onDone }: AddToListDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const trimmed = name.trim()
  const existing = trimmed ? lists.find((list) => list.name.toLowerCase() === trimmed.toLowerCase()) : undefined
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

    const { added } = result.data
    const already = count - added
    toast({
      title: `${added} personne${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''} à « ${existing?.name ?? trimmed} »`,
      description: already > 0 ? `${already} y étai${already > 1 ? 'en' : ''}t déjà.` : undefined,
    })
    setName('')
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
              Choisissez une liste ou tapez le nom d&apos;une nouvelle. Une personne peut être dans plusieurs listes.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="list-name">Liste</Label>
            <Input
              id="list-name"
              list="prospect-list-options"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Agences Lyon, Session du lundi..."
              maxLength={100}
              disabled={isSaving}
              autoFocus
            />
            <datalist id="prospect-list-options">
              {lists.map((list) => (
                <option key={list.id} value={list.name} />
              ))}
            </datalist>
            {trimmed && (
              <p className="text-sm text-muted-foreground">
                {existing
                  ? `Liste existante (${existing.count} personne${existing.count > 1 ? 's' : ''}).`
                  : 'Nouvelle liste : elle sera créée.'}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSaving || !trimmed}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
