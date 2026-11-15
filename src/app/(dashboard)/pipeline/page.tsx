import Link from 'next/link'
import { List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PipelineBoard } from '@/components/pipeline/pipeline-board'
import { getPipelineStages } from '@/lib/queries/companies'
import { getPipelineCards } from '@/lib/queries/pipeline'

export default async function PipelinePage() {
  const [cards, stages] = await Promise.all([getPipelineCards(), getPipelineStages()])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">
            Pipeline <span className="accent-serif text-primary">commercial</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Vos entreprises et vos contacts, étape par étape. Glissez une carte pour la faire avancer.
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link href="/companies">
            <List className="w-4 h-4 mr-2" />
            Vue liste
          </Link>
        </Button>
      </div>

      <PipelineBoard cards={cards} stages={stages} />
    </div>
  )
}
