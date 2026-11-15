'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import Link from 'next/link'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { differenceInCalendarDays, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  AlertCircle,
  Bell,
  Building2,
  ChevronsLeftRight,
  ExternalLink,
  MoreHorizontal,
  Search,
  Target,
  Trophy,
  UserRound,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ToastAction } from '@/components/ui/toast'
import { Counter } from '@/components/motion/counter'
import { CompanyScore } from '@/components/companies/company-stage-select'
import { updateCompanyStage } from '@/lib/actions/companies'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { contactDisplayName } from '@/lib/validations/company'
import { cn } from '@/lib/utils'
import type { PipelineCard } from '@/lib/queries/pipeline'
import type { PipelineStage } from '@/types'

type KindFilter = 'all' | 'organization' | 'individual'

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Tout' },
  { value: 'organization', label: 'Entreprises' },
  { value: 'individual', label: 'Personnes' },
]

// Nombre de cartes affichées d'emblée par colonne (« À qualifier » peut en compter des centaines)
const PAGE_SIZE = 30
const NO_STAGE = 'none'
const NO_STAGE_COLOR = '#94a3b8'

type Column = {
  id: string
  stageId: string | null
  name: string
  color: string
  kind: PipelineStage['kind']
}

type Move = { id: string; stageId: string | null }

type ReminderTone = 'overdue' | 'today' | 'soon' | 'later'

function reminderInfo(dueAt: string): { tone: ReminderTone; label: string } {
  const due = new Date(dueAt)
  const days = differenceInCalendarDays(due, new Date())
  if (days < 0) return { tone: 'overdue', label: `En retard · ${format(due, 'd MMM', { locale: fr })}` }
  if (days === 0) return { tone: 'today', label: 'Relance aujourd\'hui' }
  if (days === 1) return { tone: 'soon', label: 'Relance demain' }
  return { tone: days <= 7 ? 'soon' : 'later', label: `Relance le ${format(due, 'd MMM', { locale: fr })}` }
}

// Les relances en retard d'abord, puis les plus proches, puis les mieux notées
function compareCards(a: PipelineCard, b: PipelineCard): number {
  const aDue = a.nextReminder ? new Date(a.nextReminder.dueAt).getTime() : Infinity
  const bDue = b.nextReminder ? new Date(b.nextReminder.dueAt).getTime() : Infinity
  if (aDue !== bDue) return aDue - bDue
  return (b.score ?? -1) - (a.score ?? -1)
}

function initials(contact: PipelineCard['contacts'][number]): string {
  const letters = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .map((part) => part!.trim().charAt(0).toUpperCase())
    .join('')
  return letters || '?'
}

function isOverdue(card: PipelineCard): boolean {
  return !!card.nextReminder && differenceInCalendarDays(new Date(card.nextReminder.dueAt), new Date()) < 0
}

/**
 * Tableau kanban du pipeline commercial : une colonne par étape, une carte par fiche
 * (entreprise ou personne seule). On glisse une carte pour changer son étape ; le menu
 * « … » de chaque carte fait la même chose au clavier et sur téléphone.
 */
export function PipelineBoard({ cards, stages }: { cards: PipelineCard[]; stages: PipelineStage[] }) {
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  const [optimisticCards, applyMove] = useOptimistic(cards, (state: PipelineCard[], move: Move) =>
    state.map((card) => (card.id === move.id ? { ...card, stage_id: move.stageId } : card))
  )
  const [kindFilter, setKindFilter] = useState<KindFilter>('all')
  const [search, setSearch] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState<Record<string, number>>({})
  const [flash, setFlash] = useState<{ column: string; at: number } | null>(null)

  const stageIds = useMemo(() => new Set(stages.map((stage) => stage.id)), [stages])
  const columnOf = (card: PipelineCard) => (card.stage_id && stageIds.has(card.stage_id) ? card.stage_id : NO_STAGE)

  const columns = useMemo<Column[]>(() => {
    const list: Column[] = stages.map((stage) => ({
      id: stage.id,
      stageId: stage.id,
      name: stage.name,
      color: stage.color,
      kind: stage.kind,
    }))
    // Colonne « Sans étape » seulement si des fiches n'en ont pas
    if (optimisticCards.some((card) => !card.stage_id || !stageIds.has(card.stage_id))) {
      list.unshift({ id: NO_STAGE, stageId: null, name: 'Sans étape', color: NO_STAGE_COLOR, kind: 'open' })
    }
    return list
  }, [stages, stageIds, optimisticCards])

  const kindCounts = useMemo(
    () => ({
      all: optimisticCards.length,
      organization: optimisticCards.filter((card) => card.kind === 'organization').length,
      individual: optimisticCards.filter((card) => card.kind === 'individual').length,
    }),
    [optimisticCards]
  )

  const cardsByColumn = useMemo(() => {
    const query = search.trim().toLowerCase()
    const groups = new Map<string, PipelineCard[]>()
    for (const card of optimisticCards) {
      if (kindFilter !== 'all' && card.kind !== kindFilter) continue
      if (query) {
        const haystack = [card.name, card.city, ...card.contacts.map((contact) => contactDisplayName(contact))]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(query)) continue
      }
      const key = columnOf(card)
      const group = groups.get(key)
      if (group) group.push(card)
      else groups.set(key, [card])
    }
    groups.forEach((group) => group.sort(compareCards))
    return groups
    // columnOf ne dépend que de stageIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optimisticCards, kindFilter, search, stageIds])

  const stageKind = new Map(stages.map((stage) => [stage.id, stage.kind]))
  const stats = {
    open: optimisticCards.filter((card) => (card.stage_id ? stageKind.get(card.stage_id) ?? 'open' : 'open') === 'open').length,
    overdue: optimisticCards.filter(isOverdue).length,
    won: optimisticCards.filter((card) => card.stage_id && stageKind.get(card.stage_id) === 'won').length,
  }

  const moveCard = (cardId: string, column: Column, options: { undoable: boolean } = { undoable: true }) => {
    const card = optimisticCards.find((item) => item.id === cardId)
    if (!card) return
    // « Annuler » part de l'état connu quand le message a été créé : on ne compare pas la colonne
    if (options.undoable && columnOf(card) === column.id) return
    const previousStageId = card.stage_id

    setFlash((current) => ({ column: column.id, at: (current?.at ?? 0) + 1 }))
    startTransition(async () => {
      applyMove({ id: cardId, stageId: column.stageId })
      let result: Awaited<ReturnType<typeof updateCompanyStage>>
      try {
        result = await updateCompanyStage(cardId, column.stageId)
      } catch {
        toast({ variant: 'destructive', title: 'Étape non enregistrée', description: CONNECTION_ERROR })
        return
      }
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Étape non enregistrée', description: result.error || 'Impossible de changer l\'étape' })
        return
      }
      if (!options.undoable) return

      const previousColumn = columns.find((item) => item.stageId === previousStageId) ?? columns.find((item) => item.id === NO_STAGE)
      toast({
        title: column.kind === 'won' ? `${card.name} : piste gagnée, bravo !` : `${card.name} → ${column.name}`,
        action:
          previousColumn || previousStageId === null ? (
            <ToastAction
              altText="Annuler le déplacement"
              onClick={() =>
                moveCard(
                  cardId,
                  previousColumn ?? { id: NO_STAGE, stageId: null, name: 'Sans étape', color: NO_STAGE_COLOR, kind: 'open' },
                  { undoable: false }
                )
              }
            >
              Annuler
            </ToastAction>
          ) : undefined,
      })
    })
  }

  const toggleExpanded = (columnId: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(columnId)) next.delete(columnId)
      else next.add(columnId)
      return next
    })

  const dropHandlers = (column: Column) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!draggedId) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (overColumn !== column.id) setOverColumn(column.id)
    },
    onDragLeave: (event: React.DragEvent) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        setOverColumn((current) => (current === column.id ? null : current))
      }
    },
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      const cardId = event.dataTransfer.getData('text/plain') || draggedId
      setOverColumn(null)
      setDraggedId(null)
      if (cardId) moveCard(cardId, column)
    },
  })

  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        Aucune étape de pipeline pour le moment. Créez-les dans les{' '}
        <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
          paramètres
        </Link>
        .
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Où j'en suis, d'un coup d'œil */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:max-w-2xl">
        <StatPill icon={<Target className="size-4" />} label="Pistes en cours" value={stats.open} />
        <StatPill
          icon={<AlertCircle className="size-4" />}
          label="Relances en retard"
          value={stats.overdue}
          tone={stats.overdue > 0 ? 'alert' : undefined}
        />
        <StatPill icon={<Trophy className="size-4" />} label="Gagnées" value={stats.won} tone={stats.won > 0 ? 'success' : undefined} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="radiogroup" aria-label="Afficher" className="inline-flex shrink-0 rounded-full border bg-white p-1 shadow-soft">
          {KIND_FILTERS.map((filter) => {
            const active = kindFilter === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKindFilter(filter.value)}
                className={cn(
                  'relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="pipeline-kind-filter"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">
                  {filter.label} <span className="tabular-nums opacity-70">{kindCounts[filter.value]}</span>
                </span>
              </button>
            )
          })}
        </div>
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, ville, contact…"
            aria-label="Rechercher dans le pipeline"
            className="pl-9 bg-white"
          />
        </div>
      </div>

      <LayoutGroup>
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0 snap-x snap-mandatory md:snap-none">
          <div className="flex items-start gap-3">
            {columns.map((column) => {
              const columnCards = cardsByColumn.get(column.id) ?? []
              const closed = column.kind === 'lost' || column.kind === 'excluded'
              const collapsed = closed && !expanded.has(column.id)
              const isOver = overColumn === column.id
              const flashKey = flash?.column === column.id ? flash.at : 0

              if (collapsed) {
                return (
                  <motion.button
                    key={column.id}
                    type="button"
                    layout
                    onClick={() => toggleExpanded(column.id)}
                    {...dropHandlers(column)}
                    animate={flashKey ? { scale: [1, 1.06, 1] } : undefined}
                    transition={{ duration: 0.4 }}
                    aria-label={`Afficher la colonne ${column.name} (${columnCards.length})`}
                    className={cn(
                      'flex w-12 shrink-0 snap-start flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted',
                      isOver && 'border-solid'
                    )}
                    style={isOver ? { borderColor: column.color, backgroundColor: `${column.color}1f` } : undefined}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                    <span className="font-semibold tabular-nums text-foreground">{columnCards.length}</span>
                    <span className="[writing-mode:vertical-rl] rotate-180 font-medium">{column.name}</span>
                    <ChevronsLeftRight className="size-4 opacity-60" />
                  </motion.button>
                )
              }

              const limit = visible[column.id] ?? PAGE_SIZE
              const shown = columnCards.slice(0, limit)
              const remaining = columnCards.length - shown.length

              return (
                <motion.section
                  key={column.id}
                  layout
                  aria-label={column.name}
                  {...dropHandlers(column)}
                  animate={flashKey ? { scale: [1, 1.015, 1] } : undefined}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    'flex w-[17.5rem] shrink-0 snap-start flex-col rounded-2xl border border-transparent bg-muted/60 transition-colors',
                    column.kind === 'won' && 'bg-emerald-50/70',
                    isOver && 'border-dashed'
                  )}
                  style={isOver ? { borderColor: column.color, backgroundColor: `${column.color}1a` } : undefined}
                >
                  <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
                    <h2 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold tracking-normal">{column.name}</h2>
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={columnCards.length}
                        initial={{ y: -8, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 8, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums shadow-sm"
                      >
                        {columnCards.length}
                      </motion.span>
                    </AnimatePresence>
                    {closed && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(column.id)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-white hover:text-foreground"
                        aria-label={`Replier la colonne ${column.name}`}
                      >
                        <ChevronsLeftRight className="size-4" />
                      </button>
                    )}
                  </header>

                  <div className="flex max-h-[calc(100dvh-19rem)] min-h-40 flex-col gap-2 overflow-y-auto px-2 pb-2">
                    {shown.map((card) => (
                      <BoardCard
                        key={card.id}
                        card={card}
                        columns={columns}
                        currentColumn={column.id}
                        dragging={draggedId === card.id}
                        onDragStart={() => setDraggedId(card.id)}
                        onDragEnd={() => {
                          setDraggedId(null)
                          setOverColumn(null)
                        }}
                        onMove={(target) => moveCard(card.id, target)}
                      />
                    ))}
                    {columnCards.length === 0 && (
                      <div
                        className={cn(
                          'flex flex-1 items-center justify-center rounded-xl border border-dashed border-ink/10 px-4 py-8 text-center text-xs text-muted-foreground',
                          draggedId && 'border-ink/25'
                        )}
                      >
                        {draggedId ? 'Déposez la carte ici' : search || kindFilter !== 'all' ? 'Aucune fiche avec ces filtres' : 'Aucune fiche à cette étape'}
                      </div>
                    )}
                    {remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setVisible((current) => ({ ...current, [column.id]: limit + PAGE_SIZE }))}
                        className="rounded-xl border border-dashed border-ink/15 py-2 text-xs font-medium text-muted-foreground hover:bg-white hover:text-foreground"
                      >
                        Afficher {Math.min(PAGE_SIZE, remaining)} de plus · encore {remaining}
                      </button>
                    )}
                  </div>
                </motion.section>
              )
            })}
          </div>
        </div>
      </LayoutGroup>
    </div>
  )
}

function StatPill({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  tone?: 'alert' | 'success'
}) {
  return (
    <div className="rounded-2xl border border-ink/[0.07] bg-white px-3 py-2.5 shadow-soft sm:px-4 sm:py-3">
      <div className="flex items-center gap-1.5 text-xs leading-tight text-muted-foreground">
        <span
          className={cn(
            'hidden size-6 shrink-0 items-center justify-center rounded-md bg-secondary text-primary sm:flex',
            tone === 'alert' && 'bg-destructive/10 text-destructive',
            tone === 'success' && 'bg-emerald-100 text-emerald-700'
          )}
        >
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <Counter
        to={value}
        duration={1}
        className={cn(
          'mt-1 block font-display text-2xl font-bold tabular-nums tracking-tight',
          tone === 'alert' && 'text-destructive',
          tone === 'success' && 'text-emerald-700'
        )}
      />
    </div>
  )
}

const REMINDER_STYLES: Record<ReminderTone, string> = {
  overdue: 'bg-destructive/10 text-destructive',
  today: 'bg-amber-100 text-amber-800',
  soon: 'bg-secondary text-secondary-foreground',
  later: 'bg-muted text-muted-foreground',
}

function BoardCard({
  card,
  columns,
  currentColumn,
  dragging,
  onDragStart,
  onDragEnd,
  onMove,
}: {
  card: PipelineCard
  columns: Column[]
  currentColumn: string
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  onMove: (column: Column) => void
}) {
  const reminder = card.nextReminder ? reminderInfo(card.nextReminder.dueAt) : null
  const isIndividual = card.kind === 'individual'
  const people = isIndividual ? [] : card.contacts

  return (
    <motion.div layout="position" layoutId={card.id} transition={{ type: 'spring', stiffness: 500, damping: 40 }}>
      <div
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', card.id)
          event.dataTransfer.effectAllowed = 'move'
          onDragStart()
        }}
        onDragEnd={onDragEnd}
        className={cn(
          'group relative cursor-grab rounded-xl border border-ink/[0.06] bg-white p-3 shadow-sm transition-[box-shadow,transform,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-lift active:cursor-grabbing',
          dragging && 'rotate-2 opacity-40'
        )}
      >
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
              isIndividual ? 'bg-peach/50 text-brand-800' : 'bg-secondary text-primary'
            )}
            title={isIndividual ? 'Personne' : 'Entreprise'}
          >
            {isIndividual ? <UserRound className="size-4" /> : <Building2 className="size-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/companies/${card.id}`}
              draggable={false}
              className="line-clamp-2 text-sm font-semibold leading-snug hover:text-primary focus-visible:outline-none focus-visible:underline"
            >
              {card.name}
            </Link>
          </div>
          <CompanyScore score={card.score} />
        </div>

        <div className="mt-2.5 flex min-h-6 items-center gap-2">
          {reminder && (
            <span
              title={card.nextReminder?.title}
              className={cn('inline-flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium', REMINDER_STYLES[reminder.tone])}
            >
              <Bell className="size-3 shrink-0" />
              <span className="truncate">{reminder.label}</span>
            </span>
          )}
          {people.length > 0 && (
            <span className="ml-auto flex shrink-0 -space-x-1.5" title={people.map((person) => contactDisplayName(person)).join(', ')}>
              {people.slice(0, 3).map((person) => (
                <span
                  key={person.id}
                  className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-[10px] font-semibold text-brand-800"
                >
                  {initials(person)}
                </span>
              ))}
              {people.length > 3 && (
                <span className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-muted text-[10px] font-semibold text-muted-foreground">
                  +{people.length - 3}
                </span>
              )}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'shrink-0 rounded-md p-1 text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100',
                people.length === 0 && 'ml-auto'
              )}
              aria-label={`Actions pour ${card.name}`}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem asChild>
                <Link href={`/companies/${card.id}`}>
                  <ExternalLink className="mr-2 size-4" />
                  Ouvrir la fiche
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Déplacer vers</DropdownMenuLabel>
              {columns
                .filter((column) => column.id !== currentColumn && column.id !== NO_STAGE)
                .map((column) => (
                  <DropdownMenuItem key={column.id} onSelect={() => onMove(column)}>
                    <span className="mr-2 size-2.5 rounded-full" style={{ backgroundColor: column.color }} />
                    {column.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  )
}
