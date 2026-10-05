import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatEuros } from '@/lib/validations/company'
import { cn } from '@/lib/utils'
import type { DashboardData } from '@/lib/queries/prospection-dashboard'

export function PipelineOverview({ pipeline }: { pipeline: DashboardData['pipeline'] }) {
  const max = Math.max(1, ...pipeline.map((row) => row.count))
  // La colonne des montants n'apparaît qu'une fois un premier montant estimé saisi
  const hasAmounts = pipeline.some((row) => row.amount > 0)
  const openAmount = pipeline
    .filter((row) => (row.stage?.kind ?? 'open') === 'open')
    .reduce((total, row) => total + row.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Votre pipeline</CardTitle>
        <CardDescription>
          {hasAmounts
            ? 'Nombre d\'entreprises et montant estimé à chaque étape'
            : 'Nombre d\'entreprises à chaque étape'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2.5">
          {pipeline.map(({ stage, count, amount }) => (
            <li key={stage?.id ?? 'none'}>
              <Link
                href="/companies"
                className={cn(
                  'grid items-center gap-3 rounded-md text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  hasAmounts
                    ? 'grid-cols-[minmax(0,9rem)_1fr_4rem_2.5rem]'
                    : 'grid-cols-[minmax(0,9rem)_1fr_2.5rem]'
                )}
              >
                <span className="truncate">{stage?.name ?? 'Sans étape'}</span>
                <span className="h-2.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${(count / max) * 100}%`,
                      backgroundColor: stage?.color ?? 'hsl(var(--muted-foreground))',
                    }}
                  />
                </span>
                {hasAmounts && (
                  <span className="text-right text-muted-foreground tabular-nums">
                    {amount > 0 ? formatEuros(amount) : ''}
                  </span>
                )}
                <span className="text-right font-medium tabular-nums">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
        {openAmount > 0 && (
          <p className="text-sm border-t pt-3">
            Pistes en cours : <span className="font-semibold">{formatEuros(openAmount)} HT</span> estimés
          </p>
        )}
      </CardContent>
    </Card>
  )
}
