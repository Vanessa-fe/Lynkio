import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Personnes</h1>
          <p className="text-muted-foreground mt-2">
            Tous vos contacts, seuls ou dans une entreprise. Le statut suit les échanges que vous notez.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/people/linkedin">
              <LinkedinIcon className="w-4 h-4 mr-2" />
              Envoi LinkedIn
            </Link>
          </Button>
          <Button asChild>
            <Link href="/people/new">
              <Plus className="w-4 h-4 mr-2" />
              Ajouter une personne
            </Link>
          </Button>
        </div>
      </div>

      <PeopleList people={people} stages={stages} lists={lists} activeListId={list ?? null} />
    </div>
  )
}
