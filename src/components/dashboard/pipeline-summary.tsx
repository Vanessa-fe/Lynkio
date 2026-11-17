import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatEuros } from '@/lib/validations/company'
import type { DashboardData } from '@/lib/queries/prospection-dashboard'

/**
 * Le suivi commercial en un coup d'œil (lot 1.5) : remplace les tuiles de statistiques et la liste des
 * onze étapes. Seules les étapes en cours qui contiennent des entreprises sont montrées ; le taux de
 * réussite n'apparaît que lorsqu'il est calculable (pas de tiret à expliquer).
 */
export function PipelineSummary({ stats, pipeline }: Pick<DashboardData, 'stats' | 'pipeline'>) {
  const openStages = pipeline.filter((row) => row.stage && row.stage.kind === 'open' && row.count > 0)
  const openAmount = pipeline
    .filter((row) => (row.stage?.kind ?? 'open') === 'open')
    .reduce((total, row) => total + row.amount, 0)
  const hasSuccessRate = stats.successRate !== null && stats.won + stats.lost > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Votre suivi commercial</CardTitle>
            <p className="mt-2 font-display text-3xl font-bold tabular-nums tracking-tight">
              {stats.tracked}{' '}
              <span className="text-base font-medium text-muted-foreground">
                piste{stats.tracked > 1 ? 's' : ''} en cours
              </span>
            </p>
          </div>
          <Link
            href="/companies?vue=kanban"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            Ouvrir le Kanban
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {openStages.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Entreprises en cours, par étape">
            {openStages.map(({ stage, count }) => (
              <li key={stage!.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
                <span className="size-2 rounded-full" style={{ backgroundColor: stage!.color }} aria-hidden="true" />
                {stage!.name}
                <span className="font-semibold tabular-nums">{count}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Aucune démarche en cours : choisissez une découverte et cliquez sur « Prospecter ».
          </p>
        )}
        {(openAmount > 0 || hasSuccessRate) && (
          <p className="text-muted-foreground">
            {openAmount > 0 && <>Montant estimé en cours : {formatEuros(openAmount)} HT</>}
            {openAmount > 0 && hasSuccessRate && ' · '}
            {hasSuccessRate && (
              <>
                {stats.successRate} % de réussite ({stats.won} signée{stats.won > 1 ? 's' : ''}, {stats.lost} non
                concrétisée{stats.lost > 1 ? 's' : ''})
              </>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
