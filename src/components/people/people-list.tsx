'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListMinus, ListPlus, Plus, Search, Users, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CompanyStageSelect } from '@/components/companies/company-stage-select'
import { removeContactsFromList } from '@/lib/actions/prospect-lists'
import { OUTREACH_STATUSES, outreachStatusLabels } from '@/lib/constants/outreach'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { contactDisplayName, individualLabel } from '@/lib/validations/company'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { PersonRow, ProspectListWithCount } from '@/lib/queries/people'
import type { OutreachStatus, PipelineStage } from '@/types'
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

interface PeopleListProps {
  people: PersonRow[]
  stages: PipelineStage[]
  lists: ProspectListWithCount[]
  activeListId: string | null
}

export function PeopleList({ people, stages, lists, activeListId }: PeopleListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isAddingToList, setIsAddingToList] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  const activeList = lists.find((list) => list.id === activeListId) ?? null
  const inList = activeList ? people.filter((person) => person.listIds.includes(activeList.id)) : people

  // Recherche et type de personne d'abord : les compteurs de statut portent sur ce qui reste
  const term = search.trim().toLowerCase()
  const scoped = inList.filter((person) => {
    if (scope !== 'all' && person.company.kind !== scope) return false
    if (!term) return true
    return [person.first_name, person.last_name, person.role, person.email, person.company.name]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term))
  })
  const filtered =
    statusFilter === 'all' ? scoped : scoped.filter((person) => person.outreach.status === statusFilter)

  const countFor = (status: StatusFilter) =>
    status === 'all' ? scoped.length : scoped.filter((person) => person.outreach.status === status).length

  const selectedIds = [...selected].filter((id) => filtered.some((person) => person.id === id))
  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length

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
          <Button asChild>
            <Link href="/people/new">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une personne
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
        <ListToolbar
          lists={lists}
          activeList={activeList}
          exportableCount={inList.filter((person) => person.linkedin_url && !person.opted_out_at).length}
        />
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

      {/* Statuts déduits des échanges : un clic filtre */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
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
            {status === 'all' ? 'Tous les statuts' : outreachStatusLabels[status]}
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
          <Button size="sm" onClick={() => setIsAddingToList(true)}>
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
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ajoutez une personne seule (un indépendant, un contact LinkedIn) ou avec son entreprise.
              Les contacts de vos entreprises apparaissent aussi ici.
            </p>
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
        <div className="border rounded-lg">
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
                <TableHead>Statut</TableHead>
                <TableHead className="hidden lg:table-cell">Étape</TableHead>
                <TableHead className="hidden xl:table-cell">Prochaine action</TableHead>
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
                      <p className="text-sm text-muted-foreground">{person.role || '-'}</p>
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
                    </TableCell>
                    <TableCell>
                      <OutreachBadge
                        status={person.outreach.status}
                        lastSentAt={person.outreach.lastSentAt}
                        lastReplyAt={person.outreach.lastReplyAt}
                        showWhen
                      />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <CompanyStageSelect companyId={company.id} stageId={company.stage_id} stages={stages} />
                    </TableCell>
                    <TableCell className="hidden xl:table-cell max-w-[14rem]">
                      {company.next_action ? (
                        <p className="text-sm truncate" title={company.next_action}>
                          {company.next_action}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
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
        </div>
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
