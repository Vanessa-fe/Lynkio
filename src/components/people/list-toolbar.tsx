'use client'

import { useRouter } from 'next/navigation'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ListActions } from '@/components/lists/list-actions'
import type { ProspectListWithCount } from '@/lib/queries/people'

const ALL = 'all'

interface ListToolbarProps {
  lists: ProspectListWithCount[]
  activeList: ProspectListWithCount | null
  // Personnes de la liste qui ont un profil LinkedIn (exportables vers Waalaxy)
  exportableCount: number
}

/**
 * Choix de la liste affichée, et ce qu'on fait de cette liste (envoi LinkedIn,
 * export Waalaxy, renommage, suppression)
 */
export function ListToolbar({ lists, activeList, exportableCount }: ListToolbarProps) {
  const router = useRouter()

  const selectList = (value: string) => {
    router.push(value === ALL ? '/people' : `/people?list=${value}`)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Label htmlFor="list-select" className="shrink-0 text-sm text-muted-foreground">
          Liste
        </Label>
        <Select value={activeList?.id ?? ALL} onValueChange={selectList}>
          <SelectTrigger id="list-select" className="min-w-0 flex-1 sm:w-[260px] sm:flex-none">
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
      </div>

      {activeList && (
        <ListActions key={activeList.id} list={activeList} exportableCount={exportableCount} afterDeleteHref="/people" />
      )}
    </div>
  )
}
