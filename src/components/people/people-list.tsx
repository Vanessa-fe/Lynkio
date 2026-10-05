'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Plus, Search, Users } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CompanyStageSelect } from '@/components/companies/company-stage-select'
import { contactDisplayName, individualLabel } from '@/lib/validations/company'
import { cn } from '@/lib/utils'
import type { PersonRow } from '@/lib/queries/people'
import type { PipelineStage } from '@/types'

type Scope = 'all' | 'individual' | 'organization'

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'individual', label: 'Personnes seules' },
  { value: 'organization', label: 'Dans une entreprise' },
]

export function PeopleList({ people, stages }: { people: PersonRow[]; stages: PipelineStage[] }) {
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState<Scope>('all')

  const term = search.trim().toLowerCase()
  const filtered = people.filter((person) => {
    if (scope !== 'all' && person.company.kind !== scope) return false
    if (!term) return true
    return [person.first_name, person.last_name, person.role, person.email, person.company.name]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term))
  })

  const countFor = (value: Scope) =>
    value === 'all' ? people.length : people.filter((person) => person.company.kind === value).length

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
        <Button asChild>
          <Link href="/people/new">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une personne
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer les personnes">
        {SCOPES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setScope(value)}
            aria-pressed={scope === value}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              scope === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
            )}
          >
            {label}
            <span className={cn('text-xs', scope === value ? 'opacity-80' : 'text-muted-foreground')}>
              {countFor(value)}
            </span>
          </button>
        ))}
      </div>

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
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Aucune personne ne correspond à cette recherche</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Personne</TableHead>
                <TableHead>Entreprise</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead className="hidden lg:table-cell">Prochaine action</TableHead>
                <TableHead className="hidden md:table-cell">Dernier échange</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((person) => {
                const { company } = person
                const isIndividual = company.kind === 'individual'

                return (
                  <TableRow key={person.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                          {contactDisplayName(person)}
                        </Link>
                        {person.linkedin_url && (
                          <a
                            href={person.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Profil LinkedIn de ${contactDisplayName(person)}`}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <LinkedinIcon className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {person.opted_out_at && <Badge variant="destructive">Ne pas contacter</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{person.role || '-'}</p>
                    </TableCell>
                    <TableCell>
                      {isIndividual ? (
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
                      <CompanyStageSelect companyId={company.id} stageId={company.stage_id} stages={stages} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell max-w-[16rem]">
                      {company.next_action ? (
                        <p className="text-sm truncate" title={company.next_action}>
                          {company.next_action}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {company.last_interaction_at
                          ? formatDistanceToNow(new Date(company.last_interaction_at), { addSuffix: true, locale: fr })
                          : 'Jamais contactée'}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
