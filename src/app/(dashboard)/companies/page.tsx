import Link from 'next/link'
import { ArrowDownUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CompaniesList } from '@/components/companies/companies-list'
import { getCompanies, getLeadSources, getPipelineStages } from '@/lib/queries/companies'

export default async function CompaniesPage() {
  const [companies, stages, sources] = await Promise.all([
    getCompanies(),
    getPipelineStages(),
    getLeadSources(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entreprises</h1>
          <p className="text-muted-foreground mt-2">
            Votre pipeline de prospection : les entreprises à qualifier, contacter et suivre
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link href="/import-export">
            <ArrowDownUp className="w-4 h-4 mr-2" />
            Importer / Exporter
          </Link>
        </Button>
      </div>

      <CompaniesList companies={companies} stages={stages} sources={sources} />
    </div>
  )
}
