import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Radar } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { PipelineRun } from '@/types'
import { formatDate } from '@/lib/utils/dates'

interface SophieCardProps {
  lastRun: PipelineRun | null
  unidentifiedOffers: number
  nextRunAt: string | null
}

export function SophieCard({ lastRun, unidentifiedOffers, nextRunAt }: SophieCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-primary/10 p-2 text-primary">
              <Radar className="w-5 h-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>Sophie</CardTitle>
              <CardDescription>
                {nextRunAt
                  ? `Prochaine recherche le ${formatDate(new Date(nextRunAt), "EEEE d MMMM 'à' H'h'")}`
                  : 'Recherche automatique désactivée'}
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/prospection">Prospection</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!lastRun ? (
          <p className="text-muted-foreground">Sophie n&apos;a pas encore cherché pour vous.</p>
        ) : lastRun.status === 'running' ? (
          <p>Recherche en cours…</p>
        ) : lastRun.status === 'failed' ? (
          <p className="text-destructive">
            Dernière recherche en échec {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: fr })} :{' '}
            {lastRun.error}
          </p>
        ) : (
          <p>
            Dernière recherche {formatDistanceToNow(new Date(lastRun.started_at), { addSuffix: true, locale: fr })} :{' '}
            <strong>
              {lastRun.companies_created} entreprise{lastRun.companies_created > 1 ? 's' : ''} ajoutée
              {lastRun.companies_created > 1 ? 's' : ''}
            </strong>
            .
          </p>
        )}
        {unidentifiedOffers > 0 && (
          <p>
            <Link href="/prospection" className="font-medium hover:underline">
              {unidentifiedOffers} offre{unidentifiedOffers > 1 ? 's' : ''} anonyme{unidentifiedOffers > 1 ? 's' : ''} à identifier
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
