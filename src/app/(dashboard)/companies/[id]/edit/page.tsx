import { notFound } from 'next/navigation'
import { CompanyForm } from '@/components/companies/company-form'
import { getCompanyById, getLeadSources, getPipelineStages } from '@/lib/queries/companies'

interface EditCompanyPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditCompanyPage({ params }: EditCompanyPageProps) {
  const { id } = await params
  const [company, stages, sources] = await Promise.all([
    getCompanyById(id),
    getPipelineStages(),
    getLeadSources(),
  ])

  if (!company) {
    notFound()
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Modifier l&apos;entreprise</h1>
        <p className="text-muted-foreground mt-2">{company.name}</p>
      </div>
      <CompanyForm company={company} stages={stages} sources={sources} />
    </div>
  )
}
