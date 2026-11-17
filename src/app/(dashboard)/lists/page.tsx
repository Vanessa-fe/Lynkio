import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowRight, ListPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { Counter } from '@/components/motion/counter'
import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { ListActions } from '@/components/lists/list-actions'
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
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Regroupez vos contacts pour les contacter ensemble sur LinkedIn ou les exporter.
          </p>
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
          <Button asChild>
            <Link href="/people" title="Cochez des personnes, puis « Ajouter à une liste »">
              <ListPlus className="w-4 h-4 mr-2" />
              Créer une liste
            </Link>
          </Button>
        </div>
      </div>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-4 py-10">
            <p className="text-muted-foreground max-w-xl">
              Aucune liste pour l&apos;instant. Dans Personnes, cochez les personnes à regrouper, puis cliquez sur
              « Ajouter à une liste ».
            </p>
            <Button asChild>
              <Link href="/people">
                <Users className="w-4 h-4 mr-2" />
                Aller aux personnes
              </Link>
            </Button>
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

      <section className="flex flex-col gap-4 rounded-3xl bg-secondary px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold tracking-tight text-secondary-foreground">
            Du premier contact à la <span className="accent-serif text-primary">conversation</span>
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Regroupez vos contacts par cible : dans Personnes, cochez-les puis « Ajouter à une liste ». Sophie prépare
            ensuite les messages, que vous relisez avant l&apos;envoi.
          </p>
        </div>
        <Button variant="outline" asChild className="group shrink-0 bg-white">
          <Link href="/people">
            Voir mes contacts
            <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </section>
    </div>
  )
}
