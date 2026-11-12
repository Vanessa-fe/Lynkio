import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Preferences } from '@/components/notifications/preferences'
import { DigestRewrite } from '@/components/notifications/digest-rewrite'
import { MarkReadButton } from '@/components/notifications/mark-read-button'
import { getSophieNotifications, getSophiePreferences, type SophieNotificationRow } from '@/lib/queries/notifications'
import { SIGNAL_SOURCE_LABELS } from '@/lib/constants/signals'
import { formatDate } from '@/lib/utils/dates'

/** Bilan sans IA : les totaux de la semaine, tels qu'enregistrés */
function digestText(row: SophieNotificationRow): string {
  const c = row.counts ?? { outgoing: 0, incoming: 0, meetings: 0, notes: 0 }
  const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
  return [
    plural(c.outgoing, 'prise de contact envoyée', 'prises de contact envoyées'),
    plural(c.incoming, 'réponse reçue', 'réponses reçues'),
    plural(c.meetings, 'rendez-vous', 'rendez-vous'),
    plural(c.notes, 'note', 'notes'),
  ].join(' · ')
}

export default async function NotificationsPage() {
  const [preferences, notifications] = await Promise.all([getSophiePreferences(), getSophieNotifications()])
  const unread = notifications.filter((row) => !row.read_at).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Alertes de Sophie</h1>
        <p className="text-muted-foreground mt-2">
          Les nouveaux signaux sur les entreprises que vous suivez, et le bilan de vos actions chaque semaine. Rien n’est
          activé sans votre accord.
        </p>
      </div>

      <Preferences frequency={preferences.frequency} digest={preferences.digest} />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Vos alertes</CardTitle>
              <CardDescription className="mt-1.5">
                {unread > 0 ? `${unread} non lue${unread > 1 ? 's' : ''}` : 'Tout est lu'}. Chaque alerte n’arrive qu’une
                fois.
              </CardDescription>
            </div>
            {unread > 0 && <MarkReadButton />}
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {preferences.frequency === 'off' && !preferences.digest
                ? 'Les alertes sont désactivées. Choisissez une fréquence ci-dessus pour en recevoir.'
                : 'Pas encore d’alerte : elles arriveront à la prochaine échéance choisie.'}
            </p>
          ) : (
            <ul className="divide-y">
              {notifications.map((row) => (
                <li key={row.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!row.read_at && <Badge>Nouveau</Badge>}
                    <Badge variant="secondary">{row.kind === 'digest' ? 'Bilan' : 'Signal'}</Badge>
                    {row.kind === 'signal' && row.company_id ? (
                      <Link href={`/companies/${row.company_id}`} className="font-medium hover:underline">
                        {row.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{row.title}</span>
                    )}
                  </div>
                  {row.kind === 'signal' ? (
                    <p className="text-xs text-muted-foreground">
                      Source : {SIGNAL_SOURCE_LABELS[row.source] ?? SIGNAL_SOURCE_LABELS.unknown}
                      {row.event_at && ` · événement du ${formatDate(row.event_at, 'd MMMM yyyy')}`}
                      {row.detected_at && ` · repéré le ${formatDate(row.detected_at, 'd MMMM yyyy')}`}
                      {row.source_url && (
                        <>
                          {' · '}
                          <a
                            href={row.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 underline underline-offset-2"
                          >
                            Voir la source
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        </>
                      )}
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Du {row.period_start ? formatDate(row.period_start, 'd MMMM') : '?'} au{' '}
                        {row.period_end ? formatDate(row.period_end, 'd MMMM yyyy') : '?'} · d’après vos échanges notés
                      </p>
                      <p className="text-sm">{digestText(row)}</p>
                      <DigestRewrite id={row.id} />
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
