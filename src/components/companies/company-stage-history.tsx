import { History } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils/dates'
import type { CompanyStageEvent } from '@/lib/queries/companies'

// Qui a fait le changement (colonne changed_by du journal)
const AUTHOR_LABELS: Record<string, string> = {
  user: 'par vous',
  auto: 'automatiquement, après un échange noté',
  sophie: 'fiche créée par Sophie',
  import: 'fiche importée',
  backfill: 'étape au début du suivi',
}

const KIND_DOT: Record<string, string> = {
  open: 'bg-blue-500',
  won: 'bg-green-500',
  lost: 'bg-red-500',
  excluded: 'bg-gray-400',
}

/**
 * Historique des étapes d'une fiche : quand elle est passée d'une étape à l'autre, et pourquoi.
 * Les changements antérieurs à la création du journal (00047) ne sont pas connus.
 */
export function CompanyStageHistory({ events }: { events: CompanyStageEvent[] }) {
  if (events.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-muted-foreground" />
          Historique des étapes
        </CardTitle>
        <CardDescription>Chaque changement d&apos;étape, daté. Les changements faits avant la mise en place du suivi ne sont pas connus.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${KIND_DOT[event.to_stage_kind ?? ''] ?? 'bg-muted-foreground'}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {event.to_stage_name ? (
                    <>
                      {event.from_stage_name && (
                        <span className="text-muted-foreground">{event.from_stage_name} → </span>
                      )}
                      <span className="font-medium">{event.to_stage_name}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Étape retirée</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(event.changed_at, "d MMM yyyy 'à' HH'h'mm")}
                  {AUTHOR_LABELS[event.changed_by] && ` · ${AUTHOR_LABELS[event.changed_by]}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
