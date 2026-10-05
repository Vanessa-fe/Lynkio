import { PeopleList } from '@/components/people/people-list'
import { getPipelineStages } from '@/lib/queries/companies'
import { getPeople } from '@/lib/queries/people'

export default async function PeoplePage() {
  const [people, stages] = await Promise.all([getPeople(), getPipelineStages()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Personnes</h1>
        <p className="text-muted-foreground mt-2">
          Tous vos contacts : les personnes seules et celles de vos entreprises
        </p>
      </div>

      <PeopleList people={people} stages={stages} />
    </div>
  )
}
