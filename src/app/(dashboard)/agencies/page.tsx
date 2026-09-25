import Link from 'next/link'
import { AgenciesList } from '@/components/agencies/agencies-list'
import {
  getAgencies,
  getAgencyStatuses,
  getAgencySources,
  getAgenciesCount,
  getAgenciesToContact,
} from '@/lib/queries/agencies'
import { getTodayAgencyReminders } from '@/lib/queries/reminders'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, Building2, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { reminderPriorityLabels, reminderPriorityBadgeVariants, isReminderOverdue } from '@/lib/validations/reminder'

export default async function AgenciesPage() {
  const [agencies, statuses, sources, totalCount, todayReminders, agenciesToContact] =
    await Promise.all([
      getAgencies({ limit: 100 }),
      getAgencyStatuses(),
      getAgencySources(),
      getAgenciesCount(),
      getTodayAgencyReminders(),
      getAgenciesToContact(),
    ])

  // Éviter les doublons : une agence peut apparaître à la fois dans les relances du jour
  // et dans les "jamais contactées" si elle a aussi une relance en cours.
  const reminderAgencyIds = new Set(todayReminders.map((r) => r.agency_id).filter(Boolean))
  const newAgencies = agenciesToContact.filter((agency) => !reminderAgencyIds.has(agency.id))

  const hasTodayItems = todayReminders.length > 0 || newAgencies.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agences</h1>
        <p className="text-muted-foreground mt-2">
          Prospection B2B — agences web pour sous-traitance
        </p>
      </div>

      {/* Section "Aujourd'hui" */}
      {hasTodayItems && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              🎯 Aujourd&apos;hui
            </h2>

            {todayReminders.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Relances dues ou en retard</p>
                <div className="space-y-2">
                  {todayReminders.map((reminder) => {
                    const overdue = isReminderOverdue(
                      new Date(reminder.due_at),
                      reminder.completed_at ? new Date(reminder.completed_at) : null
                    )
                    return (
                      <Link
                        key={reminder.id}
                        href={reminder.agency_id ? `/agencies/${reminder.agency_id}` : '/reminders'}
                        className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <AlertCircle className={`w-4 h-4 ${overdue ? 'text-red-500' : 'text-amber-500'}`} />
                          <div>
                            <p className="font-medium">{reminder.title}</p>
                            {reminder.agency && (
                              <p className="text-sm text-muted-foreground">{reminder.agency.name}</p>
                            )}
                            <p className={`text-xs ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                              <Clock className="w-3 h-3 inline mr-1" />
                              {format(new Date(reminder.due_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                              {overdue && ' - En retard'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={reminderPriorityBadgeVariants[reminder.priority ?? 'medium']}>
                          {reminderPriorityLabels[reminder.priority ?? 'medium']}
                        </Badge>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {newAgencies.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Agences jamais contactées</p>
                <div className="space-y-2">
                  {newAgencies.map((agency) => (
                    <Link
                      key={agency.id}
                      href={`/agencies/${agency.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border bg-white hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{agency.name}</p>
                          {agency.city && <p className="text-sm text-muted-foreground">{agency.city}</p>}
                        </div>
                      </div>
                      {agency.status && (
                        <Badge
                          variant="outline"
                          style={{ borderColor: agency.status.color, color: agency.status.color }}
                        >
                          {agency.status.name}
                        </Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AgenciesList
        agencies={agencies}
        statuses={statuses}
        sources={sources}
        totalCount={totalCount}
      />
    </div>
  )
}
