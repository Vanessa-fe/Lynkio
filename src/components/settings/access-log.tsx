import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { describeAccessLogEntry } from '@/lib/constants/data-retention'
import { formatDate } from '@/lib/utils/dates'
import type { DataAccessAction } from '@/types/database'

type Entry = { id: number; action: DataAccessAction; details: Record<string, unknown>; created_at: string }

/**
 * Derniers accès sensibles aux données du compte : exports, clés, conservation (gardés 12 mois)
 */
export function AccessLog({ entries }: { entries: Entry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Journal d&apos;accès</CardTitle>
        <CardDescription>
          Les exports de vos données, les changements de clés personnelles et les nettoyages, gardés 12 mois. Personne
          ne peut modifier ce journal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rien pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y text-sm">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
                <span>{describeAccessLogEntry(entry.action, entry.details)}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatDate(entry.created_at, "d MMM yyyy 'à' HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
