import Link from 'next/link'
import { ArrowDownUp, Plus, SquareKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompaniesList } from '@/components/companies/companies-list'
import { getCompanies, getLeadSources, getPipelineStages } from '@/lib/queries/companies'
import { getStrategies, getStrategy } from '@/lib/queries/strategies'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ strategie?: string }> }) {
  const { strategie } = await searchParams
  const strategyId = strategie && UUID.test(strategie) ? strategie : undefined
  const [companies, stages, sources, strategy, strategies] = await Promise.all([
    getCompanies(200, { strategyId }),
    getPipelineStages(),
    getLeadSources(),
    strategyId ? getStrategy(strategyId) : Promise.resolve(null),
    // Liste déjà limitée à une recherche par l'adresse : pas de filtre « Recherche » en plus
    strategyId ? Promise.resolve([]) : getStrategies(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Entreprises</h1>
          <p className="text-muted-foreground mt-2">Les bonnes pistes, la bonne action, au bon moment.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/pipeline">
              <SquareKanban className="w-4 h-4 mr-2" />
              Vue tableau
            </Link>
          </Button>
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

      {strategyId && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span>
            Entreprises trouvées par votre recherche{' '}
            <span className="font-medium">« {strategy?.name ?? 'supprimée'} »</span>
          </span>
          <Link href="/companies" className="font-medium text-primary underline-offset-2 hover:underline">
            Voir toutes les entreprises
          </Link>
        </div>
      )}

      <CompaniesList
        companies={companies}
        stages={stages}
        sources={sources}
        strategies={strategyId ? undefined : strategies.map(({ id, name }) => ({ id, name }))}
      />
    </div>
  )
}
