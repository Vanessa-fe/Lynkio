'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListPlus, Loader2 } from 'lucide-react'
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
import { createProspectList } from '@/lib/actions/prospect-lists'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

/**
 * « Créer une liste » (page Listes) : une liste vide, à remplir ensuite depuis Personnes
 * (cocher des personnes, puis « Ajouter à une liste ») ou pendant un import.
 */
export function CreateListDialog() {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (isSaving) return
    if (next) {
      setName('')
      setError(null)
    }
    setOpen(next)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof createProspectList>>
    try {
      result = await createProspectList(name)
    } catch {
      setError(CONNECTION_ERROR)
      setIsSaving(false)
      return
    }
    setIsSaving(false)

    if (!result.success) {
      setError(result.error ?? 'Impossible de créer la liste')
      return
    }

    setOpen(false)
    toast({
      title: `Liste « ${name.trim()} » créée`,
      description: 'Pour la remplir : dans Personnes, cochez des personnes puis « Ajouter à une liste ».',
    })
    router.refresh()
  }

  return (
    <>
      <Button onClick={() => handleOpenChange(true)}>
        <ListPlus className="w-4 h-4 mr-2" />
        Créer une liste
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Nouvelle liste</DialogTitle>
              <DialogDescription>
                Vous pourrez y ranger des personnes depuis Personnes, ou pendant l’import d’un fichier.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="newListName">Nom de la liste</Label>
              <Input
                id="newListName"
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  setError(null)
                }}
                placeholder="Par exemple : Agences web Lyon"
                maxLength={100}
                autoFocus
                disabled={isSaving}
                aria-invalid={error ? true : undefined}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSaving || !name.trim()}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListPlus className="w-4 h-4 mr-2" />}
                Créer la liste
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
