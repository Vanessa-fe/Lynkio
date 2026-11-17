import Link from 'next/link'
import { ArrowDownUp, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompaniesList } from '@/components/companies/companies-list'
import { CompaniesViewToggle, type CompaniesView } from '@/components/companies/companies-view-toggle'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'
import { getCompanies, getLeadSources, getPipelineStages } from '@/lib/queries/companies'
import { getPipelineCards } from '@/lib/queries/pipeline'
import { getStrategies, getStrategy } from '@/lib/queries/strategies'
import { getPipelineRun } from '@/lib/queries/prospection'
import { getUserProfile } from '@/lib/queries/user-profile'
import { formatDate } from '@/lib/utils/dates'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Entreprises et pipeline commercial réunis (lot 1.9) : une page, deux vues.
 *   - Tableau : toutes les entreprises (découvertes, en démarche, terminées), avec les filtres ;
 *   - Kanban : les entreprises en démarche, étape par étape.
 * Vue : ?vue=tableau|kanban, sinon la dernière choisie (user_profiles.companies_view). Une liste limitée
 * à une recherche (?strategie=) ou à un passage (?passage=) s'affiche toujours en tableau.
 */
export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ strategie?: string; passage?: string; vue?: string }>
}) {
  const { strategie, passage, vue } = await searchParams
  const strategyId = strategie && UUID.test(strategie) ? strategie : undefined
  // « Voir les entreprises » à la fin d'une recherche : celles ajoutées par ce passage
  const pipelineRunId = !strategyId && passage && UUID.test(passage) ? passage : undefined
  const filtered = Boolean(strategyId || pipelineRunId)

  const profile = vue === 'tableau' || vue === 'kanban' || filtered ? null : await getUserProfile()
  const view: CompaniesView =
    filtered || vue === 'tableau' ? 'table' : vue === 'kanban' ? 'kanban' : profile?.companies_view === 'kanban' ? 'kanban' : 'table'

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Entreprises</h1>
          <p className="text-muted-foreground mt-2">
            {view === 'kanban'
              ? 'Vos entreprises en démarche, étape par étape. Glissez une carte pour la faire avancer.'
              : 'Vos découvertes et votre suivi commercial, au même endroit.'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CompaniesViewToggle view={view} />
          <Button variant="outline" asChild>
            <Link href="/import-export">
              <ArrowDownUp className="w-4 h-4 mr-2" />
              Importer / Exporter
            </Link>
          </Button>
          <Button asChild>
            <Link href="/companies/new">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une entreprise
            </Link>
          </Button>
        </div>
      </div>

      {view === 'kanban' ? <KanbanView /> : <TableView strategyId={strategyId} pipelineRunId={pipelineRunId} />}
    </div>
  )
}

async function KanbanView() {
  const [cards, stages] = await Promise.all([getPipelineCards(), getPipelineStages()])
  return <PipelineBoard cards={cards} stages={stages} />
}

async function TableView({ strategyId, pipelineRunId }: { strategyId?: string; pipelineRunId?: string }) {
  const [companies, stages, sources, strategy, strategies, run] = await Promise.all([
    getCompanies(200, { strategyId, pipelineRunId }),
    getPipelineStages(),
    getLeadSources(),
    strategyId ? getStrategy(strategyId) : Promise.resolve(null),
    // Liste déjà limitée à une recherche par l'adresse : pas de filtre « Recherche » en plus
    strategyId || pipelineRunId ? Promise.resolve([]) : getStrategies(),
    pipelineRunId ? getPipelineRun(pipelineRunId) : Promise.resolve(null),
  ])

  return (
    <>
      {pipelineRunId && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            Entreprises ajoutées par la recherche
            {run ? ` du ${formatDate(new Date(run.started_at), "d MMMM 'à' HH:mm")}` : ''}
          </span>
          <Link href="/companies?vue=tableau" className="font-medium text-primary underline-offset-2 hover:underline">
            Voir toutes les entreprises
          </Link>
        </div>
      )}

      {strategyId && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            Entreprises trouvées par votre recherche{' '}
            <span className="font-medium">« {strategy?.name ?? 'supprimée'} »</span>
          </span>
          <Link href="/companies?vue=tableau" className="font-medium text-primary underline-offset-2 hover:underline">
            Voir toutes les entreprises
          </Link>
        </div>
      )}

      <CompaniesList
        companies={companies}
        stages={stages}
        sources={sources}
        strategies={strategyId || pipelineRunId ? undefined : strategies.map(({ id, name }) => ({ id, name }))}
      />
    </>
  )
}
