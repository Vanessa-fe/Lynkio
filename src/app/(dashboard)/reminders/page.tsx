import { AlertCircle, CalendarDays, Sun } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Counter } from '@/components/motion/counter'
import { RemindersList } from '@/components/reminders/reminders-list'
import { ReminderFormDialog } from '@/components/reminders/reminder-form-dialog'
import { RemindersWeek, reminderDayKey } from '@/components/reminders/reminders-week'
import { getReminders, getRemindersCount } from '@/lib/queries/reminders'
import { getCompanyChoices } from '@/lib/queries/prospection'
import { cn } from '@/lib/utils'

const DAY_MS = 24 * 60 * 60 * 1000

function StatTile({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number
  detail: string
  tone?: 'alert'
}) {
  return (
    <Card>
      <CardContent className="space-y-1.5 p-4 sm:p-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
          <span
            className={cn(
              'hidden size-7 items-center justify-center rounded-lg bg-secondary text-primary sm:flex',
              tone === 'alert' && 'bg-destructive/10 text-destructive'
            )}
          >
            {icon}
          </span>
          {label}
        </div>
        <Counter
          to={value}
          duration={1}
          className={cn(
            'block font-display text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
            tone === 'alert' && 'text-destructive'
          )}
        />
        <p className="text-xs text-muted-foreground sm:text-sm">{detail}</p>
      </CardContent>
    </Card>
  )
}

export default async function RemindersPage() {
  const [reminders, totalCount, companies] = await Promise.all([
    getReminders({ limit: 100 }),
    getRemindersCount(),
    getCompanyChoices(),
  ])

  // Compteurs sur les relances à faire, par jour calendaire (heure de Paris)
  const now = new Date()
  const todayKey = reminderDayKey(now)
  const weekEndKey = reminderDayKey(new Date(now.getTime() + 6 * DAY_MS))
  const pendingKeys = reminders
    .filter((reminder) => !reminder.completed_at)
    .map((reminder) => reminderDayKey(reminder.due_at))
  const today = pendingKeys.filter((key) => key === todayKey).length
  const overdue = pendingKeys.filter((key) => key < todayKey).length
  const week = pendingKeys.filter((key) => key >= todayKey && key <= weekEndKey).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold md:text-4xl">Relances</h1>
          <p className="text-muted-foreground mt-2">
            Gardez le fil, sans rien garder en tête. Une piste qu&apos;on ne relance pas est une piste perdue.
          </p>
        </div>
        <div className="shrink-0">
          <ReminderFormDialog companies={companies} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatTile
          icon={<Sun className="size-4" />}
          label="Aujourd’hui"
          value={today}
          detail={today > 0 ? 'Les prochaines conversations' : 'Rien de prévu'}
        />
        <StatTile
          icon={<AlertCircle className="size-4" />}
          label="En retard"
          value={overdue}
          detail={overdue > 0 ? 'À reprendre en priorité' : 'Vous êtes à jour'}
          tone={overdue > 0 ? 'alert' : undefined}
        />
        <StatTile
          icon={<CalendarDays className="size-4" />}
          label="Cette semaine"
          value={week}
          detail="Sur les 7 prochains jours"
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <RemindersList reminders={reminders} totalCount={totalCount} companies={companies} hideCreate />
        <div className="xl:sticky xl:top-6">
          <RemindersWeek reminders={reminders} now={now} />
        </div>
      </div>
    </div>
  )
}
