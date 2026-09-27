import Link from 'next/link'
import { format, formatDistanceStrict } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PipelineRun } from '@/types'

// Contenu de pipeline_runs.details écrit par la fonction prospection-run
type RunDetails = {
  departments?: string[]
  skip_reasons?: Record<string, number>
  created?: { id: string; name: string }[]
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

export function PipelineRunsList({ runs }: { runs: PipelineRun[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historique</CardTitle>
        <CardDescription>Les dernières recherches de Sophie</CardDescription>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aucune recherche pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y">
            {runs.map((run) => (
              <RunItem key={run.id} run={run} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function RunItem({ run }: { run: PipelineRun }) {
  const details = (run.details ?? {}) as RunDetails
  const created = details.created ?? []
  const skipReasons = Object.entries(details.skip_reasons ?? {}).sort((a, b) => b[1] - a[1])
  const startedAt = new Date(run.started_at)

  return (
    <li className="py-4 first:pt-0 last:pb-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {run.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-primary" aria-hidden="true" />}
        {run.status === 'succeeded' && <CheckCircle2 className="w-4 h-4 text-green-600" aria-hidden="true" />}
        {run.status === 'failed' && <AlertTriangle className="w-4 h-4 text-destructive" aria-hidden="true" />}
        <span className="font-medium">
          {format(startedAt, "EEEE d MMMM 'à' HH:mm", { locale: fr })}
        </span>
        <Badge variant="outline">{run.triggered_by === 'manual' ? 'Lancée par vous' : 'Planifiée'}</Badge>
        {run.finished_at && (
          <span className="text-xs text-muted-foreground">
            en {formatDistanceStrict(new Date(run.finished_at), startedAt, { locale: fr })}
          </span>
        )}
      </div>

      {run.status === 'running' ? (
        <p className="text-sm text-muted-foreground">En cours…</p>
      ) : run.status === 'failed' ? (
        <p className="text-sm text-destructive">{run.error}</p>
      ) : (
        <p className="text-sm">
          <strong>{plural(run.companies_created, 'entreprise ajoutée', 'entreprises ajoutées')}</strong>
          <span className="text-muted-foreground">
            {' '}
            sur {plural(run.companies_seen, 'création examinée', 'créations examinées')}
          </span>
        </p>
      )}

      {created.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {created.map((company) => (
            <li key={company.id}>
              <Link
                href={`/companies/${company.id}`}
                className="inline-block rounded-md border px-2 py-0.5 text-sm hover:bg-muted"
              >
                {company.name}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {skipReasons.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            {plural(run.companies_skipped, 'création écartée', 'créations écartées')}
          </summary>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {skipReasons.map(([reason, count]) => (
              <li key={reason}>
                {reason} : {count}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}
