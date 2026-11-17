'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { List, SquareKanban } from 'lucide-react'
import { saveCompaniesView } from '@/lib/actions/user-profile'
import { cn } from '@/lib/utils'

export type CompaniesView = 'table' | 'kanban'

const VIEWS: { value: CompaniesView; label: string; param: string; icon: typeof List }[] = [
  { value: 'table', label: 'Tableau', param: 'tableau', icon: List },
  { value: 'kanban', label: 'Kanban', param: 'kanban', icon: SquareKanban },
]

/**
 * Tableau ou Kanban sur la page Entreprises (lot 1.9). Le choix est gardé sur le compte : on retrouve
 * sa vue en revenant, même depuis un autre appareil.
 */
export function CompaniesViewToggle({ view }: { view: CompaniesView }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const choose = (next: CompaniesView) => {
    if (next === view) return
    startTransition(async () => {
      // Mémorisation au mieux : la vue change même si l'enregistrement échoue
      await saveCompaniesView(next).catch(() => undefined)
      router.push(`/companies?vue=${VIEWS.find((option) => option.value === next)!.param}`)
    })
  }

  return (
    <div role="radiogroup" aria-label="Affichage des entreprises" className="inline-flex rounded-lg border bg-card p-1">
      {VIEWS.map(({ value, label, icon: Icon }) => {
        const active = value === view
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(value)}
            disabled={isPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
