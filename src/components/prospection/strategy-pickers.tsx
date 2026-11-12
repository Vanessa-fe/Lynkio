'use client'

import { useMemo, useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SECTOR_GROUPS, sectorSuggestions } from '@/lib/constants/client-sectors'
import { DEPARTMENTS, DEPARTMENT_LIST } from '@/lib/validations/prospection'
import { cn } from '@/lib/utils/cn'

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

/** Secteurs à cocher : d'abord les suggestions du métier, « Voir tous les secteurs » pour le reste */
export function SectorPicker({
  value,
  onChange,
  professionKey,
  approach,
  disabled,
}: {
  value: string[]
  onChange: (next: string[]) => void
  professionKey: string | null
  approach: 'profile' | 'partner'
  disabled?: boolean
}) {
  const [showAll, setShowAll] = useState(false)
  const suggested = sectorSuggestions(professionKey, approach)
  const visible = useMemo(() => {
    if (showAll || suggested.length === 0) return SECTOR_GROUPS
    return SECTOR_GROUPS.filter((group) => suggested.includes(group.key) || value.includes(group.key))
  }, [showAll, suggested, value])

  return (
    <div className="space-y-2">
      {suggested.length > 0 && !showAll && <p className="text-sm text-muted-foreground">Suggestions pour votre métier :</p>}
      <div className="flex flex-wrap gap-2">
        {visible.map((group) => {
          const selected = value.includes(group.key)
          return (
            <button
              key={group.key}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(toggle(value, group.key))}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
                selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/50'
              )}
            >
              {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
              {group.label}
            </button>
          )
        })}
      </div>
      {suggested.length > 0 && (
        <Button type="button" variant="link" className="h-auto px-0" onClick={() => setShowAll((current) => !current)}>
          {showAll ? 'Voir seulement les suggestions' : 'Voir tous les secteurs'}
        </Button>
      )}
    </div>
  )
}

/** Départements choisis (20 au plus), avec une liste pour en ajouter */
export function DepartmentPicker({
  value,
  onChange,
  disabled,
  id,
}: {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
  id?: string
}) {
  return (
    <div className="space-y-2">
      <Select value="" onValueChange={(code) => onChange([...value, code])} disabled={disabled || value.length >= 20}>
        <SelectTrigger id={id} className="sm:w-80" aria-label="Ajouter un département">
          <SelectValue placeholder="Ajouter un département" />
        </SelectTrigger>
        <SelectContent>
          {DEPARTMENT_LIST.filter(([code]) => !value.includes(code)).map(([code, label]) => (
            <SelectItem key={code} value={code}>
              {code} · {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Départements choisis">
          {value.map((code) => (
            <li key={code} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
              {code} · {DEPARTMENTS[code] ?? code}
              <button
                type="button"
                onClick={() => onChange(value.filter((item) => item !== code))}
                disabled={disabled}
                className="rounded-full p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Retirer ${DEPARTMENTS[code] ?? code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aucun département choisi.</p>
      )}
    </div>
  )
}
