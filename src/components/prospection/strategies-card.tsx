'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, MoreHorizontal, Pause, Pencil, Play, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { APPROACH_LABELS, STRATEGY_SIZES, sectorGroup } from '@/lib/constants/client-sectors'
import { deleteStrategy, setStrategyActive } from '@/lib/actions/strategies'
import { launchStrategy } from '@/lib/actions/prospection'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { formatDate } from '@/lib/utils/dates'
import type { StrategyOverview } from '@/lib/queries/strategies'
import { StrategyDialog } from './strategy-dialog'

interface StrategiesCardProps {
  strategies: StrategyOverview[]
  professionKey: string | null
  defaultDepartments: string[]
  // Un passage est déjà en cours
  isRunning: boolean
}

const SIZE_SHORT: Record<string, string> = Object.fromEntries(
  STRATEGY_SIZES.map((size) => [size.value, size.label.split(' ')[0] ?? size.value])
)

function summary(strategy: StrategyOverview): string {
  const sectors = strategy.sectorGroups.map((key) => sectorGroup(key)?.label ?? key)
  const sectorText = sectors.length > 2 ? `${sectors.slice(0, 2).join(', ')} et ${sectors.length - 2} autre${sectors.length > 3 ? 's' : ''}` : sectors.join(', ')
  const sizes = strategy.sizes.map((size) => SIZE_SHORT[size] ?? size).join(', ')
  const zone = strategy.departments.length > 3 ? `${strategy.departments.length} départements` : strategy.departments.join(', ')
  return `${sectorText} · ${sizes} · ${zone}`
}

/**
 * Recherches enregistrées (recherche par profil d'entreprise) : Sophie les lance à chaque passage,
 * ou tout de suite avec « Lancer ».
 */
export function StrategiesCard({ strategies, professionKey, defaultDepartments, isRunning }: StrategiesCardProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StrategyOverview | null>(null)
  const [pending, setPending] = useState<string | null>(null)

  const run = async (key: string, action: () => Promise<{ success: boolean; error?: string }>, success?: string) => {
    setPending(key)
    try {
      const result = await action()
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Action impossible', description: result.error })
        return
      }
      if (success) toast({ title: success })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible', description: CONNECTION_ERROR })
    } finally {
      setPending(null)
    }
  }

  const openNew = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" aria-hidden />
              Vos recherches
            </CardTitle>
            <CardDescription className="mt-1.5">
              Des entreprises qui correspondent à votre profil de client : secteur, taille, zone. Sophie les cherche
              dans le registre officiel, sans IA, et ne vous montre jamais deux fois la même.
            </CardDescription>
          </div>
          <Button type="button" onClick={openNew} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle recherche
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {strategies.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune recherche pour l’instant. Créez-en une en trois étapes : qui vous cherchez, quelle taille, où.
          </p>
        ) : (
          <ul className="divide-y">
            {strategies.map((strategy) => (
              <li key={strategy.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{strategy.name}</span>
                    <Badge variant="secondary">{APPROACH_LABELS[strategy.approach]}</Badge>
                    {!strategy.isActive && <Badge variant="outline">En pause</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{summary(strategy)}</p>
                  <p className="text-xs text-muted-foreground">
                    {strategy.companiesFound > 0 ? (
                      <Link href={`/companies?strategie=${strategy.id}`} className="underline underline-offset-2 hover:text-foreground">
                        {strategy.companiesFound} entreprise{strategy.companiesFound > 1 ? 's' : ''} trouvée{strategy.companiesFound > 1 ? 's' : ''}
                      </Link>
                    ) : (
                      'Aucune entreprise trouvée pour l’instant'
                    )}
                    {strategy.lastRunAt && ` · dernière recherche le ${formatDate(new Date(strategy.lastRunAt), "d MMMM 'à' HH:mm")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isRunning || pending !== null}
                    onClick={() =>
                      run(`launch:${strategy.id}`, () => launchStrategy(strategy.id), 'Sophie cherche : les entreprises arrivent dans « À qualifier »')
                    }
                  >
                    {pending === `launch:${strategy.id}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    Lancer
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" size="icon" variant="ghost" aria-label={`Autres actions pour ${strategy.name}`} disabled={pending !== null}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setEditing(strategy)
                          setDialogOpen(true)
                        }}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => run(`toggle:${strategy.id}`, () => setStrategyActive(strategy.id, !strategy.isActive))}>
                        {strategy.isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                        {strategy.isActive ? 'Mettre en pause' : 'Réactiver'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          if (window.confirm(`Supprimer la recherche « ${strategy.name} » ? Les entreprises déjà trouvées restent.`)) {
                            run(`delete:${strategy.id}`, () => deleteStrategy(strategy.id), 'Recherche supprimée')
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <StrategyDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        professionKey={professionKey}
        defaultDepartments={defaultDepartments}
        strategy={editing}
      />
    </Card>
  )
}
