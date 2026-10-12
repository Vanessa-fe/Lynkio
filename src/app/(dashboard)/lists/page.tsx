import Link from 'next/link'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ArrowRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { ListActions } from '@/components/lists/list-actions'
import { getListsOverview, type ListOverview } from '@/lib/queries/lists'

function plural(count: number, one: string, many: string) {
  return `${count} ${count > 1 ? many : one}`
}

function details(list: ListOverview): string {
  return [
    plural(list.count, 'personne', 'personnes'),
    plural(list.linkedinCount, 'avec LinkedIn', 'avec LinkedIn'),
    list.inProgressCount > 0 && plural(list.inProgressCount, 'en cours d\'envoi', 'en cours d\'envoi'),
    `créée le ${format(new Date(list.createdAt), 'd MMMM yyyy', { locale: fr })}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

export default async function ListsPage() {
  const lists = await getListsOverview()

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Listes</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Vos groupes de personnes, pour prospecter par lots : envoi LinkedIn avec les messages de Sophie, ou export
            pour Waalaxy.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/people/linkedin">
            <LinkedinIcon className="w-4 h-4 mr-2" />
            Envoi LinkedIn
          </Link>
        </Button>
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
        <ul className="space-y-3">
          {lists.map((list) => (
            <li key={list.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/people?list=${list.id}`} className="text-lg font-semibold hover:underline">
                    {list.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">{details(list)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" asChild>
                    <Link href={`/people?list=${list.id}`}>
                      Voir les personnes
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                  <ListActions list={list} exportableCount={list.linkedinCount} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
