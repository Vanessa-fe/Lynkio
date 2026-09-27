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
      <div>
        <h1 className="text-3xl font-bold">Entreprises</h1>
        <p className="text-muted-foreground mt-2">
          Votre pipeline de prospection : les entreprises à qualifier, contacter et suivre
        </p>
      </div>

      <CompaniesList companies={companies} stages={stages} sources={sources} />
    </div>
  )
}
