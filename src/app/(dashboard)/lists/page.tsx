import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { Counter } from '@/components/motion/counter'
import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { ListActions } from '@/components/lists/list-actions'
import { CreateListDialog } from '@/components/lists/create-list-dialog'
import { ContactsTabs } from '@/components/people/contacts-tabs'
import { getListsOverview, type ListOverview } from '@/lib/queries/lists'

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`
}

function ListCard({ list }: { list: ListOverview }) {
  const others = list.count - list.initials.length

  return (
    <Card className="flex h-full flex-col transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lift">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="space-y-2">
          <Link
            href={`/people?list=${list.id}`}
            className="line-clamp-2 font-display text-lg font-semibold tracking-tight hover:text-primary"
          >
            {list.name}
          </Link>
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {plural(list.linkedinCount, 'avec LinkedIn', 'avec LinkedIn')}
            </span>
            {list.inProgressCount > 0 && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {plural(list.inProgressCount, 'en cours d’envoi', 'en cours d’envoi')}
              </span>
            )}
          </div>
        </div>

        <p className="font-display text-3xl font-bold tabular-nums tracking-tight">
          <Counter to={list.count} duration={1} />
          <span className="ml-2 text-lg font-semibold text-muted-foreground">
            {list.count > 1 ? 'personnes' : 'personne'}
          </span>
        </p>

        {list.count > 0 && (
          <div className="flex -space-x-1.5" aria-hidden="true">
            {list.initials.map((initials, index) => (
              <span
                key={index}
                className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-brand-100 text-xs font-semibold text-brand-800"
              >
                {initials}
              </span>
            ))}
            {others > 0 && (
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-muted text-xs font-semibold text-muted-foreground">
                +{others}
              </span>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Créée le {format(new Date(list.createdAt), 'd MMMM yyyy', { locale: fr })}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-4">
          <Button variant="outline" size="sm" asChild className="group">
            <Link href={`/people?list=${list.id}`}>
              Ouvrir la liste
              <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <ListActions list={list} exportableCount={list.linkedinCount} compact />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function ListsPage() {
  const lists = await getListsOverview()

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Contacts</h1>
          <div className="mt-4">
            <ContactsTabs active="lists" />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/people/linkedin">
              <LinkedinIcon className="w-4 h-4 mr-2" />
              Envoi LinkedIn
            </Link>
          </Button>
          <CreateListDialog />
        </div>
      </div>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <p className="text-muted-foreground max-w-xl">
              Aucune liste. Créez-en une ici, ou dans Personnes : cochez des contacts puis « Ajouter à une liste ».
            </p>
          </CardContent>
        </Card>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" stagger={0.06}>
          {lists.map((list) => (
            <StaggerItem key={list.id} className="h-full">
              <ListCard list={list} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

    </div>
  )
}
