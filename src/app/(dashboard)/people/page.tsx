import { PeopleList } from '@/components/people/people-list'
import { getPipelineStages } from '@/lib/queries/companies'
import { getPeople, getProspectLists } from '@/lib/queries/people'

interface PeoplePageProps {
  searchParams: Promise<{ list?: string }>
}

export default async function PeoplePage({ searchParams }: PeoplePageProps) {
  const { list } = await searchParams
  const [people, stages, lists] = await Promise.all([getPeople(), getPipelineStages(), getProspectLists()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Personnes</h1>
        <p className="text-muted-foreground mt-2">
          Tous vos contacts, seuls ou dans une entreprise. Le statut suit les échanges que vous notez.
        </p>
      </div>

      <PeopleList people={people} stages={stages} lists={lists} activeListId={list ?? null} />
    </div>
  )
}
