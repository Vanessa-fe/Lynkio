'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListMinus, ListPlus, Loader2, Search, Users, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useStartLinkedin } from '@/components/linkedin/use-start-linkedin'
import { SegmentBadge } from '@/components/companies/company-segment'
import { SEGMENTS, segmentLabels } from '@/lib/constants/segments'
import { removeContactsFromList } from '@/lib/actions/prospect-lists'
import { OUTREACH_STATUSES, outreachStatusLabels } from '@/lib/constants/outreach'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { contactDisplayName, individualLabel } from '@/lib/validations/company'
import { useToast } from '@/lib/hooks/use-toast'
import { useSessionState } from '@/lib/hooks/use-session-state'
import { cn } from '@/lib/utils'
import type { PersonRow, ProspectListWithCount } from '@/lib/queries/people'
import type { OutreachStatus } from '@/types'
import { AddToListDialog } from './add-to-list-dialog'
import { ImportProspectsDialog } from './import-prospects-dialog'
import { ListToolbar } from './list-toolbar'
import { LogExchangeMenu } from './log-exchange-menu'
import { OutreachBadge } from './outreach-badge'

type Scope = 'all' | 'individual' | 'organization'
type StatusFilter = 'all' | OutreachStatus

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Seules ou en entreprise' },
  { value: 'individual', label: 'Personnes seules' },
  { value: 'organization', label: 'Dans une entreprise' },
]


function initials(person: Pick<PersonRow, 'first_name' | 'last_name' | 'email'>): string {
  const letters = [person.first_name, person.last_name]
    .map((part) => part?.trim().charAt(0).toUpperCase() ?? '')
    .join('')
  return letters || person.email?.charAt(0).toUpperCase() || '?'
}

type PeopleView = {
  search: string
  scope: Scope
  // Segment de la fiche de la personne : 'all', un segment, ou 'none' (non classée)
  segment: string
  statusFilter: StatusFilter
  selected: string[]
}

const STATUS_FILTERS: StatusFilter[] = ['all', ...OUTREACH_STATUSES]

function parsePeopleView(raw: unknown): PeopleView {
  const saved = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof PeopleView, unknown>>) : {}
  return {
    search: typeof saved.search === 'string' ? saved.search : '',
    scope: SCOPES.some((option) => option.value === saved.scope) ? (saved.scope as Scope) : 'all',
    segment: typeof saved.segment === 'string' ? saved.segment : 'all',
    statusFilter: STATUS_FILTERS.includes(saved.statusFilter as StatusFilter) ? (saved.statusFilter as StatusFilter) : 'all',
    selected: Array.isArray(saved.selected) ? saved.selected.filter((id): id is string => typeof id === 'string') : [],
  }
}

interface PeopleListProps {
  people: PersonRow[]
  lists: ProspectListWithCount[]
  activeListId: string | null
}

export function PeopleList({ people, lists, activeListId }: PeopleListProps) {
  const router = useRouter()
  const { toast } = useToast()
  // Filtres et sélection gardés pour la session, par liste : on les retrouve en revenant de l'envoi
  // LinkedIn ou d'une fiche (lot 1.4)
  const [view, setView] = useSessionState(`filonea:people-view:${activeListId ?? 'all'}`, parsePeopleView)
  const { search, scope, segment, statusFilter } = view
  const selected = new Set(view.selected)
  const setSearch = (value: string) => setView({ ...view, search: value })
  const setScope = (value: Scope) => setView({ ...view, scope: value })
  const setSegment = (value: string) => setView({ ...view, segment: value })
  const setStatusFilter = (value: StatusFilter) => setView({ ...view, statusFilter: value })
  const setSelected = (next: Set<string> | ((current: Set<string>) => Set<string>)) =>
    setView({ ...view, selected: [...(typeof next === 'function' ? next(selected) : next)] })
  const [isAddingToList, setIsAddingToList] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const { start: startLinkedin, isStarting } = useStartLinkedin()

  const activeList = lists.find((list) => list.id === activeListId) ?? null
  const inList = activeList ? people.filter((person) => person.listIds.includes(activeList.id)) : people

  // Recherche et type de personne d'abord : les compteurs de statut portent sur ce qui reste
  const term = search.trim().toLowerCase()
  const scoped = inList.filter((person) => {
    if (scope !== 'all' && person.company.kind !== scope) return false
    if (segment !== 'all' && (person.company.segment ?? 'none') !== segment) return false
    if (!term) return true
    return [person.first_name, person.last_name, person.role, person.email, person.company.name]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term))
  })
  const filtered =
    statusFilter === 'all' ? scoped : scoped.filter((person) => person.outreach.status === statusFilter)

  // Filtres secondaires actifs (segment, type de personne)
  const secondaryFilters = (segment !== 'all' ? 1 : 0) + (scope !== 'all' ? 1 : 0)

  const countFor = (status: StatusFilter) =>
    status === 'all' ? scoped.length : scoped.filter((person) => person.outreach.status === status).length

  const selectedIds = [...selected].filter((id) => filtered.some((person) => person.id === id))
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length
  // Parmi elles, celles qu'on peut inviter sur LinkedIn
  const linkedinCount = filtered.filter(
    (person) => selected.has(person.id) && person.linkedin_url && !person.opted_out_at
  ).length

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(filtered.map((person) => person.id)) : new Set())
  }

  const handleRemoveFromList = async () => {
    if (!activeList) return
    setIsRemoving(true)
    let result: Awaited<ReturnType<typeof removeContactsFromList>>
    try {
      result = await removeContactsFromList(activeList.id, selectedIds)
    } catch {
      toast({ variant: 'destructive', title: 'Retrait impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setIsRemoving(false)
    }
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Retrait impossible', description: result.error })
      return
    }
    toast({
      title: `${selectedIds.length} personne${selectedIds.length > 1 ? 's' : ''} retirée${selectedIds.length > 1 ? 's' : ''} de « ${activeList.name} »`,
    })
    setSelected(new Set())
    router.refresh()
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            type="search"
            placeholder="Nom, poste, e-mail, entreprise..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-10"
            aria-label="Rechercher une personne"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ImportProspectsDialog />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <ListToolbar
          lists={lists}
          activeList={activeList}
          exportableCount={inList.filter((person) => person.linkedin_url && !person.opted_out_at).length}
        />
        {/* Filtres secondaires, repliés (lot 1.10) ; le nombre d'actifs reste visible */}
        <details className="group sm:ml-auto" open={secondaryFilters > 0}>
          <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground hover:text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
            Plus de filtres{secondaryFilters > 0 ? ` (${secondaryFilters})` : ''}
          </summary>
        <div className="mt-2 flex flex-col sm:flex-row gap-2">
          <Select value={segment} onValueChange={setSegment}>
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filtrer par segment">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les segments</SelectItem>
              {SEGMENTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {segmentLabels[value]}
                </SelectItem>
              ))}
              <SelectItem value="none">Non classées</SelectItem>
            </SelectContent>
          </Select>
          <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
            <SelectTrigger className="w-full sm:w-[230px]" aria-label="Filtrer par type de personne">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCOPES.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        </details>
      </div>

      {/* Statut de chaque personne, déduit de ses échanges : un clic filtre. À ne pas confondre avec l'étape
          commerciale de son entreprise (page Entreprises) */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par statut du contact">
        <span className="text-sm text-muted-foreground">Statut du contact :</span>
        {(['all', ...OUTREACH_STATUSES] as StatusFilter[]).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            aria-pressed={statusFilter === status}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              statusFilter === status ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            {status === 'all' ? 'Toutes' : outreachStatusLabels[status]}
            <span className={cn('text-xs', statusFilter === status ? 'opacity-80' : 'text-muted-foreground')}>
              {countFor(status)}
            </span>
          </button>
        ))}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2">
          <span className="text-sm font-medium mr-2">
            {selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}
          </span>
          {linkedinCount > 0 && (
            <Button
              size="sm"
              onClick={async () => {
                // La sélection reste cochée : on la retrouve en revenant de la page d'envoi
                await startLinkedin(
                  { contactIds: selectedIds },
                  activeList ? { from: 'list', listId: activeList.id } : { from: 'people' }
                )
              }}
              disabled={isStarting}
            >
              {isStarting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LinkedinIcon className="w-4 h-4 mr-2" />}
              Envoyer sur LinkedIn ({linkedinCount})
            </Button>
          )}
          <Button size="sm" variant={linkedinCount > 0 ? 'outline' : 'default'} onClick={() => setIsAddingToList(true)}>
            <ListPlus className="w-4 h-4 mr-2" />
            Ajouter à une liste
          </Button>
          {activeList && (
            <Button size="sm" variant="outline" onClick={handleRemoveFromList} disabled={isRemoving}>
              <ListMinus className="w-4 h-4 mr-2" />
              Retirer de la liste
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="w-4 h-4 mr-2" />
            Annuler
          </Button>
        </div>
      )}

      {people.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Users className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Aucune personne pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">Ajoutez une personne seule ou avec son entreprise.</p>
          </CardContent>
        </Card>
      ) : activeList && inList.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <p className="font-medium">La liste « {activeList.name} » est vide</p>
            <p className="text-sm text-muted-foreground">
              Revenez à « Toutes les personnes », cochez celles à ajouter, puis « Ajouter à une liste ».
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Aucune personne ne correspond à ces filtres</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-xl">Votre carnet de contacts</CardTitle>
            <span className="text-sm text-muted-foreground tabular-nums">
              {filtered.length} personne{filtered.length > 1 ? 's' : ''}
            </span>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => toggleAll(checked === true)}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead>Personne</TableHead>
                <TableHead className="hidden sm:table-cell">Entreprise</TableHead>
                <TableHead>Statut du contact</TableHead>
                <TableHead className="hidden lg:table-cell">Prochaine action</TableHead>
                <TableHead className="text-right">Noter</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((person) => {
                const { company } = person
                const name = contactDisplayName(person)

                return (
                  <TableRow key={person.id} data-state={selected.has(person.id) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(person.id)}
                        onCheckedChange={(checked) => toggle(person.id, checked === true)}
                        aria-label={`Sélectionner ${name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800 sm:flex"
                          aria-hidden="true"
                        >
                          {initials(person)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                              {name}
                            </Link>
                            {person.linkedin_url && (
                              <a
                                href={person.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Profil LinkedIn de ${name}`}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <LinkedinIcon className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{person.role || 'Fonction inconnue'}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {company.kind === 'individual' ? (
                        <Badge variant="outline" className="font-normal">
                          {individualLabel(company)}
                        </Badge>
                      ) : (
                        <Link href={`/companies/${company.id}`} className="text-sm hover:underline">
                          {company.name}
                        </Link>
                      )}
                      <SegmentBadge segment={company.segment} className="ml-2" />
                    </TableCell>
                    <TableCell>
                      <OutreachBadge
                        status={person.outreach.status}
                        lastSentAt={person.outreach.lastSentAt}
                        lastReplyAt={person.outreach.lastReplyAt}
                        showWhen
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[14rem]">
                      {company.next_action ? (
                        <p className="text-sm truncate" title={company.next_action}>
                          {company.next_action}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">À définir</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <LogExchangeMenu contactId={person.id} personName={name} optedOut={!!person.opted_out_at} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <AddToListDialog
        contactIds={selectedIds}
        lists={lists}
        open={isAddingToList}
        onOpenChange={setIsAddingToList}
        onDone={() => setSelected(new Set())}
      />
    </div>
  )
}
