'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Ellipsis, Loader2, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { deleteProspectList, renameProspectList } from '@/lib/actions/prospect-lists'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { ProspectListWithCount } from '@/lib/queries/people'

const ALL = 'all'

interface ListToolbarProps {
  lists: ProspectListWithCount[]
  activeList: ProspectListWithCount | null
  // Personnes de la liste qui ont un profil LinkedIn (exportables vers Waalaxy)
  exportableCount: number
}

/**
 * Choix de la liste affichée, export Waalaxy de la liste, renommage et suppression
 */
export function ListToolbar({ lists, activeList, exportableCount }: ListToolbarProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const selectList = (value: string) => {
    router.push(value === ALL ? '/people' : `/people?list=${value}`)
  }

  const startRenaming = () => {
    setNewName(activeList?.name ?? '')
    setError(null)
    setIsRenaming(true)
  }

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeList) return
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof renameProspectList>>
    try {
      result = await renameProspectList(activeList.id, newName)
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

  const handleDelete = async () => {
    if (!activeList) return
    if (!confirm(`Supprimer la liste « ${activeList.name} » ? Les personnes restent dans Lynkio.`)) return
    let result: Awaited<ReturnType<typeof deleteProspectList>>
    try {
      result = await deleteProspectList(activeList.id)
    } catch {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: CONNECTION_ERROR })
      return
    }
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Suppression impossible', description: result.error })
      return
    }
    toast({ title: 'Liste supprimée', description: activeList.name })
    router.push('/people')
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={activeList?.id ?? ALL} onValueChange={selectList}>
        <SelectTrigger className="w-full sm:w-[260px]" aria-label="Liste affichée">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Toutes les personnes</SelectItem>
          {lists.map((list) => (
            <SelectItem key={list.id} value={list.id}>
              {list.name} ({list.count})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeList && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={`Gérer la liste ${activeList.name}`}>
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
          {exportableCount > 0 ? (
            <Button variant="outline" asChild>
              <a href={`/api/export/waalaxy?list=${activeList.id}`} download>
                <Download className="w-4 h-4 mr-2" />
                Exporter pour Waalaxy ({exportableCount})
              </a>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">Aucun profil LinkedIn à exporter</span>
          )}
        </>
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
              <Label htmlFor="rename-list">Nom</Label>
              <Input
                id="rename-list"
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
    </div>
  )
}
