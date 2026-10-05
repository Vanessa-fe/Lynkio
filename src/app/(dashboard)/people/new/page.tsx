import { PersonForm } from '@/components/people/person-form'
import { getPipelineStages } from '@/lib/queries/companies'
import { getOrganizationOptions } from '@/lib/queries/people'

export default async function NewPersonPage() {
  const [organizations, stages] = await Promise.all([getOrganizationOptions(), getPipelineStages()])

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Ajouter une personne</h1>
        <p className="text-muted-foreground mt-2">Seule, ou avec son entreprise</p>
      </div>
      <PersonForm organizations={organizations} stages={stages} />
    </div>
  )
}
