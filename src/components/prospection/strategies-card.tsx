'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, MoreHorizontal, Pause, Pencil, Play, Plus, Search, Sparkles, Trash2 } from 'lucide-react'
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
import { StrategyAssistantDialog } from './strategy-assistant-dialog'

interface StrategiesCardProps {
  strategies: StrategyOverview[]
  professionKey: string | null
  defaultDepartments: string[]
  // Un passage est déjà en cours
  isRunning: boolean
  // Recherches permises par l'offre (5 en Essentiel, 20 en Pro)
  maxStrategies: number
  // Clé d'IA enregistrée : la conversation guidée avec Sophie est possible
  hasAiKey: boolean
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
export function StrategiesCard({
  strategies,
  professionKey,
  defaultDepartments,
  isRunning,
  maxStrategies,
  hasAiKey,
}: StrategiesCardProps) {
  const atLimit = strategies.length >= maxStrategies
  const router = useRouter()
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<StrategyOverview | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  // Chaque ouverture repart d'un formulaire neuf
  const [dialogKey, setDialogKey] = useState(0)
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantKey, setAssistantKey] = useState(0)

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
    setDialogKey((key) => key + 1)
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
          <div className="flex shrink-0 flex-col gap-1 sm:items-end">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={atLimit}
                onClick={() => {
                  setAssistantKey((key) => key + 1)
                  setAssistantOpen(true)
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Décrire à Sophie
              </Button>
              <Button type="button" onClick={openNew} disabled={atLimit}>
                <Plus className="mr-2 h-4 w-4" />
                Nouvelle recherche
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              {strategies.length} recherche{strategies.length > 1 ? 's' : ''} sur {maxStrategies}
              {atLimit && ' : supprimez-en une pour en créer une autre'}
            </span>
          </div>
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
                  {strategy.runs.length > 0 && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="w-fit cursor-pointer select-none underline-offset-2 hover:text-foreground hover:underline">
                        Historique des passages
                      </summary>
                      <ul className="mt-1 space-y-0.5 pl-4">
                        {strategy.runs.map((run) => (
                          <li key={run.runId}>
                            {formatDate(new Date(run.startedAt), "d MMMM 'à' HH:mm")} ·{' '}
                            {run.triggeredBy === 'schedule' ? 'automatique' : 'lancé par vous'} · {run.created} entreprise
                            {run.created > 1 ? 's' : ''} ajoutée{run.created > 1 ? 's' : ''}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-1 pl-4">
                        Sophie ne vous montre jamais deux fois la même entreprise, quelle que soit la source.
                      </p>
                    </details>
                  )}
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
                          setDialogKey((key) => key + 1)
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
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        professionKey={professionKey}
        defaultDepartments={defaultDepartments}
        strategy={editing}
      />
      <StrategyAssistantDialog
        key={`assistant-${assistantKey}`}
        open={assistantOpen}
        onOpenChange={setAssistantOpen}
        hasAiKey={hasAiKey}
        professionKey={professionKey}
        defaultDepartments={defaultDepartments}
        onUseForm={openNew}
      />
    </Card>
  )
}
