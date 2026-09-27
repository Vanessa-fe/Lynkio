import { CompanyForm } from '@/components/companies/company-form'
import { getLeadSources, getPipelineStages } from '@/lib/queries/companies'

export default async function NewCompanyPage() {
  const [stages, sources] = await Promise.all([getPipelineStages(), getLeadSources()])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Ajouter une entreprise</h1>
        <p className="text-muted-foreground mt-2">Une entreprise que vous souhaitez prospecter</p>
      </div>
      <CompanyForm stages={stages} sources={sources} />
    </div>
  )
}
