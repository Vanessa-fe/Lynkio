import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LinkedinQueue } from '@/components/linkedin/linkedin-queue'
import { getLinkedinQueue, LINKEDIN_CAPS } from '@/lib/queries/linkedin'
import { getProspectLists } from '@/lib/queries/people'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface LinkedinOutreachPageProps {
  // D'où l'on vient (lot 1.4) : depuis=personnes | liste (avec liste=<id>) | listes
  searchParams: Promise<{ depuis?: string; liste?: string }>
}

export default async function LinkedinOutreachPage({ searchParams }: LinkedinOutreachPageProps) {
  const { depuis, liste } = await searchParams
  const listId = depuis === 'liste' && liste && UUID.test(liste) ? liste : null
  const [{ sequences, counters, automation, readAt }, lists] = await Promise.all([
    getLinkedinQueue(),
    listId ? getProspectLists() : Promise.resolve([]),
  ])
  const list = listId ? (lists.find((candidate) => candidate.id === listId) ?? null) : null

  // Retour vers le contexte d'origine ; Personnes et la liste retrouvent leurs filtres et leur sélection
  const back = list
    ? { href: `/people?list=${list.id}`, label: `Liste « ${list.name} »` }
    : depuis === 'listes'
      ? { href: '/lists', label: 'Listes' }
      : { href: '/people', label: 'Personnes' }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={back.href}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          {back.label}
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Envoi LinkedIn</h1>
      </div>

      <LinkedinQueue
        sequences={sequences}
        counters={counters}
        caps={LINKEDIN_CAPS}
        automation={automation}
        now={readAt}
        backHref={back.href}
        sourceLabel={list ? `de la liste « ${list.name} »` : null}
        fromSelection={depuis !== undefined}
      />
    </div>
  )
}
