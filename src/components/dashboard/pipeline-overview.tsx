import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardData } from '@/lib/queries/prospection-dashboard'

export function PipelineOverview({ pipeline }: { pipeline: DashboardData['pipeline'] }) {
  const max = Math.max(1, ...pipeline.map((row) => row.count))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Votre pipeline</CardTitle>
        <CardDescription>Nombre d&apos;entreprises à chaque étape</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {pipeline.map(({ stage, count }) => (
            <li key={stage?.id ?? 'none'}>
              <Link
                href="/companies"
                className="grid grid-cols-[minmax(0,9rem)_1fr_2.5rem] items-center gap-3 rounded-md text-sm hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <span className="text-right font-medium tabular-nums">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
