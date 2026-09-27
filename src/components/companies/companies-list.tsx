'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Search, Plus, Trash2, Eye, Globe, Building2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { companyAge, toWebsiteDomain, toWebsiteUrl } from '@/lib/validations/company'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { CompanyWithRelations, LeadSource, PipelineStage } from '@/types'
import { CompanyScore, CompanyStageSelect } from './company-stage-select'

interface CompaniesListProps {
  companies: CompanyWithRelations[]
  stages: PipelineStage[]
  sources: LeadSource[]
}

const ALL = 'all'

export function CompaniesList({ companies, stages, sources }: CompaniesListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>(ALL)
  const [sourceFilter, setSourceFilter] = useState<string>(ALL)
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
      [company.name, company.website, company.city, company.sector, company.registration_id]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term))

    const matchesStage = stageFilter === ALL || (company.stage_id ?? 'none') === stageFilter
    const matchesSource = sourceFilter === ALL || company.source_id === sourceFilter

    return matchesSearch && matchesStage && matchesSource
  })

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

  return (
    <div className="space-y-6">
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
        <Button asChild>
          <Link href="/companies/new">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter une entreprise
          </Link>
        </Button>
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredCompanies.length} entreprise{filteredCompanies.length !== 1 ? 's' : ''}
          {filteredCompanies.length !== companies.length && ` sur ${companies.length}`}
        </p>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="sm:w-[220px]" aria-label="Filtrer par source">
            <SelectValue placeholder="Toutes les sources" />
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

      {companies.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Building2 className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Aucune entreprise pour l&apos;instant</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Ajoutez une entreprise à la main. Bientôt, Sophie déposera ici celles qu&apos;elle
              détecte, dans l&apos;étape « À qualifier ».
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
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="hidden lg:table-cell">Site web</TableHead>
                <TableHead className="hidden xl:table-cell">Stack</TableHead>
                <TableHead className="hidden md:table-cell">Dernier échange</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link href={`/companies/${company.id}`} className="font-medium hover:underline">
                      {company.name}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {[company.city, company.sector, companyAge(company.founded_on)?.age]
                        .filter(Boolean)
                        .join(' · ') || '-'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <CompanyStageSelect
                      companyId={company.id}
                      stageId={company.stage_id}
                      stages={stages}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <CompanyScore score={company.score} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {company.website ? (
                      <a
                        href={toWebsiteUrl(company.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm inline-flex items-center gap-1 hover:underline"
                      >
                        <Globe className="w-3 h-3" />
                        {toWebsiteDomain(company.website)}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {company.detected_stack.length > 0 ? (
                        company.detected_stack.map((tech) => (
                          <Badge key={tech} variant="outline" className="text-xs">
                            {tech}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </div>
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
        </div>
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
