import { RemindersList } from '@/components/reminders/reminders-list'
import { ReminderFormDialog } from '@/components/reminders/reminder-form-dialog'
import { RemindersWeek } from '@/components/reminders/reminders-week'
import { getReminders, getRemindersCount } from '@/lib/queries/reminders'
import { getCompanyChoices } from '@/lib/queries/prospection'

/**
 * Suivi (lot 1.10, décision du 17/11/2026 : relances seulement, le Kanban reste dans Entreprises).
 * Les relances par jour : aujourd'hui, en retard, à venir, puis les terminées, gardées en historique.
 */
export default async function RemindersPage() {
  // Relances à faire, et les 50 dernières terminées pour l'historique (filtre « Terminées » ou « Toutes »)
  const [pending, completed, totalCount, companies] = await Promise.all([
    getReminders({ limit: 200 }),
    getReminders({ limit: 50, onlyCompleted: true }),
    getRemindersCount(),
    getCompanyChoices(),
  ])
  const reminders = [...pending, ...completed]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Suivi</h1>
          <p className="text-muted-foreground mt-2">Vos relances : aujourd&apos;hui, en retard et à venir.</p>
        </div>
        <div className="shrink-0">
          <ReminderFormDialog companies={companies} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <RemindersList reminders={reminders} totalCount={totalCount} companies={companies} hideCreate />
        <div className="xl:sticky xl:top-6">
          <RemindersWeek reminders={reminders} now={new Date()} />
        </div>
      </div>
    </div>
  )
}
