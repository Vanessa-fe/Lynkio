import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LinkedinQueue } from '@/components/linkedin/linkedin-queue'
import { getLinkedinQueue, LINKEDIN_CAPS } from '@/lib/queries/linkedin'

export default async function LinkedinOutreachPage() {
  const { sequences, counters } = await getLinkedinQueue()

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/people">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Personnes
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Envoi LinkedIn</h1>
        <p className="text-muted-foreground mt-2 max-w-3xl">
          Les invitations et les messages de Sophie, personne par personne. Pour l&apos;instant, vous envoyez sur LinkedIn
          et vous notez ici ce qui est fait : l&apos;extension s&apos;en chargera bientôt.
        </p>
      </div>

      <LinkedinQueue sequences={sequences} counters={counters} caps={LINKEDIN_CAPS} />
    </div>
  )
}
