'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, Trash2, Eye, Building2, Filter, MessagesSquare } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Counter } from '@/components/motion/counter'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { deleteCompany } from '@/lib/actions/companies'
import { companyAge, formatEuros, individualLabel } from '@/lib/validations/company'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { CompanyWithRelations, LeadSource, PipelineStage } from '@/types'
import { CompanyScore, CompanyStageSelect } from './company-stage-select'
import { ProspectingToggle } from './prospecting-toggle'
import { SegmentBadge } from './company-segment'
import { SEGMENTS, segmentLabels } from '@/lib/constants/segments'

interface CompaniesListProps {
  companies: CompanyWithRelations[]
  stages: PipelineStage[]
  sources: LeadSource[]
  // Recherches enregistrées, pour filtrer par recherche d'origine (absent : liste déjà filtrée par l'adresse)
  strategies?: { id: string; name: string }[]
}

const ALL = 'all'

// Filtres gardés pour la session (onglet) : on les retrouve en revenant d'une fiche.
// Stockage du navigateur, avec une copie en mémoire s'il est indisponible (navigation privée).
const FILTERS_KEY = 'companies-list-filters'

type Filters = {
  // Découvertes, en démarche, terminées (lot 1.8b)
  pipeline: string
  // Ordre du tableau (lot 1.6)
  sort: SortKey
  stage: string
  source: string
  segment: string
  search: string
  strategy: string
  score: string
  contact: string
}
const DEFAULT_FILTERS: Filters = {
  pipeline: ALL,
  sort: 'score',
  stage: ALL,
  source: ALL,
  segment: ALL,
  search: '',
  strategy: ALL,
  score: ALL,
  contact: ALL,
}

// Mêmes paliers que la couleur du score (CompanyScore)
const SCORE_FILTERS = [
  { value: 'high', label: 'Score élevé (70 et plus)' },
  { value: 'medium', label: 'Score moyen (40 à 69)' },
  { value: 'low', label: 'Score faible (moins de 40)' },
  { value: 'none', label: 'Pas encore notées' },
] as const

function matchesScore(score: number | null, filter: string): boolean {
  if (filter === ALL) return true
  if (score === null) return filter === 'none'
  if (filter === 'high') return score >= 70
  if (filter === 'medium') return score >= 40 && score < 70
  if (filter === 'low') return score < 40
  return false
}

// Ordre du tableau. Âge : d'après la date de création au registre ; âge inconnu toujours en dernier
type SortKey = 'score' | 'youngest' | 'oldest' | 'recent'
const SORTS: { value: SortKey; label: string }[] = [
  { value: 'score', label: 'Meilleur score' },
  { value: 'youngest', label: 'Plus jeunes d’abord' },
  { value: 'oldest', label: 'Plus anciennes d’abord' },
  { value: 'recent', label: 'Ajoutées récemment' },
]

function foundedTime(foundedOn: string | null): number | null {
  if (!foundedOn) return null
  const time = new Date(`${foundedOn}T00:00:00`).getTime()
  return Number.isNaN(time) ? null : time
}

function compareCompanies(sort: SortKey, a: CompanyWithRelations, b: CompanyWithRelations): number {
  if (sort === 'recent') return b.created_at.localeCompare(a.created_at)
  if (sort === 'youngest' || sort === 'oldest') {
    const left = foundedTime(a.founded_on)
    const right = foundedTime(b.founded_on)
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1
    return sort === 'youngest' ? right - left : left - right
  }
  return (b.score ?? -1) - (a.score ?? -1)
}

// Découverte : pas encore en démarche (ni écartée) ; en démarche : suivi actif ; terminée : signée, perdue, hors cible
const PIPELINE_FILTERS = [ALL, 'discovered', 'engaged', 'closed']

function pipelineState(company: { engaged_at: string | null }, kind: string | undefined): string {
  if (!company.engaged_at) return kind === 'excluded' ? 'excluded' : 'discovered'
  return kind && kind !== 'open' ? 'closed' : 'engaged'
}

let memoryFilters = ''
const filterListeners = new Set<() => void>()

function subscribeFilters(listener: () => void) {
  filterListeners.add(listener)
  return () => {
    filterListeners.delete(listener)
  }
}

function readFilters(): string {
  try {
    return window.sessionStorage.getItem(FILTERS_KEY) ?? memoryFilters
  } catch {
    return memoryFilters
  }
}

function writeFilters(filters: Filters) {
  memoryFilters = JSON.stringify(filters)
  try {
    window.sessionStorage.setItem(FILTERS_KEY, memoryFilters)
  } catch {
    // stockage indisponible : la copie en mémoire suffit pour la visite
  }
  filterListeners.forEach((listener) => listener())
}

function parseFilters(raw: string): Filters {
  try {
    const saved = raw ? (JSON.parse(raw) as Partial<Filters>) : {}
    return {
      pipeline: PIPELINE_FILTERS.includes(saved.pipeline as string) ? (saved.pipeline as string) : ALL,
      sort: SORTS.some((option) => option.value === saved.sort) ? (saved.sort as SortKey) : 'score',
      stage: typeof saved.stage === 'string' ? saved.stage : ALL,
      source: typeof saved.source === 'string' ? saved.source : ALL,
      segment: typeof saved.segment === 'string' ? saved.segment : ALL,
      search: typeof saved.search === 'string' ? saved.search : '',
      strategy: typeof saved.strategy === 'string' ? saved.strategy : ALL,
      score: typeof saved.score === 'string' ? saved.score : ALL,
      contact: typeof saved.contact === 'string' ? saved.contact : ALL,
    }
  } catch {
    return DEFAULT_FILTERS
  }
}

export function CompaniesList({ companies, stages, sources, strategies }: CompaniesListProps) {
  const router = useRouter()
  const { toast } = useToast()
  // Serveur : filtres par défaut ; navigateur : ceux de la session
  const filters = parseFilters(useSyncExternalStore(subscribeFilters, readFilters, () => ''))
  const { stage: stageFilter, source: sourceFilter, segment: segmentFilter, search } = filters
  // Une recherche supprimée entre-temps ne doit pas laisser la liste vide sans explication
  const strategyFilter =
    strategies && (filters.strategy === ALL || filters.strategy === 'none' || strategies.some((s) => s.id === filters.strategy))
      ? filters.strategy
      : ALL
  const { score: scoreFilter, contact: contactFilter } = filters
  const setStrategyFilter = (strategy: string) => writeFilters({ ...filters, strategy })
  const setScoreFilter = (score: string) => writeFilters({ ...filters, score })
  const setContactFilter = (contact: string) => writeFilters({ ...filters, contact })
  // Une étape précise remplace le filtre découvertes / en démarche (et inversement)
  const setStageFilter = (stage: string) => writeFilters({ ...filters, stage, pipeline: ALL })
  const sortKey = filters.sort
  const setSort = (sort: SortKey) => writeFilters({ ...filters, sort })
  const pipelineFilter = filters.pipeline
  const setPipelineFilter = (pipeline: string) => writeFilters({ ...filters, pipeline, stage: ALL })
  const kindByStage = new Map(stages.map((stage) => [stage.id, stage.kind]))
  const stateOf = (company: CompanyWithRelations) =>
    pipelineState(company, company.stage_id ? kindByStage.get(company.stage_id) : undefined)
  const setSourceFilter = (source: string) => writeFilters({ ...filters, source })
  const setSegmentFilter = (segment: string) => writeFilters({ ...filters, segment })
  const setSearch = (value: string) => writeFilters({ ...filters, search: value })
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Nombre d'entreprises par étape, pour la vue d'ensemble du pipeline
  const countByStage = useMemo(() => {
    const counts = new Map<string, number>()
    for (const company of companies) {
      const key = company.stage_id ?? 'none'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }, [companies])

  const filteredCompanies = companies.filter((company) => {
    const term = search.trim().toLowerCase()
    const matchesSearch =
      !term ||
      [company.name, company.website, company.city, company.sector, company.registration_id, company.next_action]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))

    const matchesStage = stageFilter === ALL || (company.stage_id ?? 'none') === stageFilter
    const matchesPipeline = pipelineFilter === ALL || stateOf(company) === pipelineFilter
    const matchesSource = sourceFilter === ALL || company.source_id === sourceFilter
    const matchesSegment = segmentFilter === ALL || (company.segment ?? 'none') === segmentFilter

    const matchesStrategy = strategyFilter === ALL || (company.strategy_id ?? 'none') === strategyFilter
    const matchesContact =
      contactFilter === ALL ||
      (contactFilter === 'never' ? company.last_interaction_at === null : company.last_interaction_at !== null)

    return (
      matchesSearch &&
      matchesPipeline &&
      matchesStage &&
      matchesSource &&
      matchesSegment &&
      matchesStrategy &&
      matchesScore(company.score, scoreFilter) &&
      matchesContact
    )
  })

  // Le serveur renvoie les entreprises par score ; les autres ordres se font ici, sans recharger
  const sortedCompanies = sortKey === 'score' ? filteredCompanies : [...filteredCompanies].sort((a, b) => compareCompanies(sortKey, a, b))

  const handleDelete = async (company: CompanyWithRelations) => {
    if (
      !confirm(
        `Supprimer ${company.name} ? Ses contacts, signaux et échanges seront aussi supprimés.`
      )
    ) {
      return
    }

    setDeletingId(company.id)
    const result = await deleteCompany(company.id)
    setDeletingId(null)

    if (result.success) {
      toast({ title: 'Entreprise supprimée', description: company.name })
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  const noStageCount = countByStage.get('none') ?? 0

  // Compteurs du haut : tout, les découvertes à examiner, et le suivi commercial en cours (lot 1.8b)
  const countState = (state: string) => companies.filter((company) => stateOf(company) === state).length
  const tiles = [
    { key: ALL, label: 'Entreprises', detail: 'Votre portefeuille', icon: Building2, count: companies.length },
    { key: 'discovered', label: 'Découvertes', detail: 'À examiner', icon: Filter, count: countState('discovered') },
    {
      key: 'engaged',
      label: 'En démarche',
      detail: 'Votre suivi commercial',
      icon: MessagesSquare,
      count: countState('engaged'),
    },
  ]

  // Libellés des filtres, écrits dès le rendu serveur : sans eux, Radix laisse les listes vides
  // le temps que la page se charge dans le navigateur
  const strategyLabel =
    strategyFilter === ALL
      ? 'Toutes les recherches'
      : strategyFilter === 'none'
        ? 'Hors recherche (ajoutées autrement)'
        : (strategies?.find((strategy) => strategy.id === strategyFilter)?.name ?? 'Toutes les recherches')
  const scoreLabel = SCORE_FILTERS.find((option) => option.value === scoreFilter)?.label ?? 'Tous les scores'
  const contactLabel =
    contactFilter === 'never' ? 'Jamais contactées' : contactFilter === 'contacted' ? 'Déjà contactées' : 'Contactées ou non'
  const segmentLabel =
    segmentFilter === 'none'
      ? 'Non classées'
      : ((segmentLabels as Record<string, string>)[segmentFilter] ?? 'Tous les segments')
  const sourceLabel = sources.find((source) => source.id === sourceFilter)?.name ?? 'Toutes les sources'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 sm:gap-4" role="group" aria-label="Filtrer par étape (raccourcis)">
        {tiles.map(({ key, label, detail, icon: Icon, count }) => {
          const active = pipelineFilter === key && stageFilter === ALL
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPipelineFilter(key)}
              aria-pressed={active}
              className={cn(
                'group flex flex-col justify-start rounded-2xl border border-ink/[0.07] bg-card p-4 text-left shadow-soft transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:shadow-lift sm:p-5',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active && 'border-primary/40 ring-1 ring-primary/30'
              )}
            >
              <span className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
                <span className="hidden size-7 items-center justify-center rounded-lg bg-secondary text-primary sm:flex">
                  <Icon className="size-4" />
                </span>
                {label}
              </span>
              <Counter
                to={count}
                duration={1}
                className="mt-1.5 block font-display text-2xl font-bold tabular-nums tracking-tight sm:text-3xl"
              />
              <span className="mt-1 block text-xs text-muted-foreground sm:text-sm">{detail}</span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="search"
            placeholder="Nom, site, ville, secteur, SIREN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            aria-label="Rechercher une entreprise"
          />
        </div>
      </div>

      {/* Vue d'ensemble du pipeline : un clic filtre sur l'étape */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par étape">
        <StageChip
          label="Toutes"
          count={companies.length}
          active={stageFilter === ALL}
          onClick={() => setStageFilter(ALL)}
        />
        {stages.map((stage) => (
          <StageChip
            key={stage.id}
            label={stage.name}
            color={stage.color}
            count={countByStage.get(stage.id) ?? 0}
            active={stageFilter === stage.id}
            onClick={() => setStageFilter(stage.id)}
          />
        ))}
        {noStageCount > 0 && (
          <StageChip
            label="Sans étape"
            count={noStageCount}
            active={stageFilter === 'none'}
            onClick={() => setStageFilter('none')}
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {strategies && strategies.length > 0 && (
            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger className="w-full" aria-label="Filtrer par recherche">
                <SelectValue placeholder="Toutes les recherches">{strategyLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Toutes les recherches</SelectItem>
                {strategies.map((strategy) => (
                  <SelectItem key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">Hors recherche (ajoutées autrement)</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={scoreFilter} onValueChange={setScoreFilter}>
            <SelectTrigger className="w-full" aria-label="Filtrer par score">
              <SelectValue placeholder="Tous les scores">{scoreLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les scores</SelectItem>
              {SCORE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={contactFilter} onValueChange={setContactFilter}>
            <SelectTrigger className="w-full" aria-label="Filtrer par prise de contact">
              <SelectValue placeholder="Contactées ou non">{contactLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Contactées ou non</SelectItem>
              <SelectItem value="never">Jamais contactées</SelectItem>
              <SelectItem value="contacted">Déjà contactées</SelectItem>
            </SelectContent>
          </Select>
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger className="w-full" aria-label="Filtrer par segment">
              <SelectValue placeholder="Tous les segments">{segmentLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les segments</SelectItem>
              {SEGMENTS.map((segment) => (
                <SelectItem key={segment} value={segment}>
                  {segmentLabels[segment]}
                </SelectItem>
              ))}
              <SelectItem value="none">Non classées</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-full" aria-label="Filtrer par source">
              <SelectValue placeholder="Toutes les sources">{sourceLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source.id} value={source.id}>
                  {source.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {companies.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Aucune entreprise pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ajoutez une entreprise à la main, ou lancez une recherche dans Prospection : les entreprises
              trouvées arrivent ici comme découvertes, à examiner.
            </p>
          </CardContent>
        </Card>
      ) : filteredCompanies.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Aucune entreprise ne correspond à ces filtres</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-xl">Vos entreprises</CardTitle>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <span className="text-sm text-muted-foreground tabular-nums">
                {filteredCompanies.length} entreprise{filteredCompanies.length !== 1 ? 's' : ''}
                {filteredCompanies.length !== companies.length && ` sur ${companies.length}`}
              </span>
              <Select value={sortKey} onValueChange={(value) => setSort(value as SortKey)}>
                <SelectTrigger className="h-9 w-[13rem]" aria-label="Trier les entreprises">
                  <SelectValue>{SORTS.find((option) => option.value === sortKey)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead
                  className="hidden lg:table-cell"
                  aria-sort={sortKey === 'youngest' ? 'descending' : sortKey === 'oldest' ? 'ascending' : 'none'}
                >
                  {/* Un clic trie par ancienneté : plus jeunes, puis plus anciennes */}
                  <button
                    type="button"
                    onClick={() => setSort(sortKey === 'youngest' ? 'oldest' : 'youngest')}
                    className="inline-flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Âge
                    {sortKey === 'youngest' ? (
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : sortKey === 'oldest' ? (
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ArrowUpDown className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="hidden md:table-cell">Prochaine action</TableHead>
                <TableHead className="hidden md:table-cell">Dernier échange</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                        {company.name}
                      </Link>
                      <SegmentBadge segment={company.segment} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {[
                        company.kind === 'individual' && individualLabel(company),
                        company.city,
                        company.sector,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Ville et secteur non renseignés'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {/* Découverte : on décide d'abord de la prospecter ; ensuite, l'étape se choisit ici */}
                    {stateOf(company) === 'discovered' ? (
                      <ProspectingToggle companyId={company.id} engagedAt={null} excluded={false} compact />
                    ) : (
                      <CompanyStageSelect companyId={company.id} stageId={company.stage_id} stages={stages} />
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <CompanyScore score={company.score} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell whitespace-nowrap">
                    <AgeCell foundedOn={company.founded_on} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-[16rem]">
                    {company.next_action ? (
                      <p className="text-sm truncate" title={company.next_action}>
                        {company.next_action}
                      </p>
                    ) : (
                      <span className="text-sm text-muted-foreground">À définir</span>
                    )}
                    {company.estimated_amount != null && (
                      <p className="text-xs text-muted-foreground">{formatEuros(company.estimated_amount)} HT</p>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-sm text-muted-foreground">
                      {company.last_interaction_at
                        ? formatDistanceToNow(new Date(company.last_interaction_at), {
                            addSuffix: true,
                            locale: fr,
                          })
                        : 'Jamais contactée'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/companies/${company.id}`} aria-label={`Voir ${company.name}`}>
                          <Eye className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(company)}
                        disabled={deletingId === company.id}
                        aria-label={`Supprimer ${company.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function StageChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string
  count: number
  color?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
      )}
    >
      {color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className={cn('text-xs', active ? 'opacity-80' : 'text-muted-foreground')}>{count}</span>
    </button>
  )
}

/** Âge d'après la date de création au registre ; inconnu quand le registre ne la donne pas */
function AgeCell({ foundedOn }: { foundedOn: string | null }) {
  const age = companyAge(foundedOn)
  if (!age) return <span className="text-sm text-muted-foreground">Inconnu</span>
  return (
    <span className="text-sm" title={`Créée en ${age.since}`}>
      {age.age}
    </span>
  )
}
