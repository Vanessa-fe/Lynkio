import { CalendarDays } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils/dates'
import type { ReminderWithRelations } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_DOTS = 4

/** Jour calendaire (heure de Paris) d'une relance, pour les regrouper */
export function reminderDayKey(value: Date | string): string {
  return formatDate(value, 'yyyy-MM-dd')
}

/**
 * Les 7 prochains jours d'un coup d'œil : un point par relance à faire,
 * et les relances en retard en tête
 */
export function RemindersWeek({ reminders, now }: { reminders: ReminderWithRelations[]; now: Date }) {
  const pending = reminders.filter((reminder) => !reminder.completed_at)
  const todayKey = reminderDayKey(now)
  const byDay = new Map<string, ReminderWithRelations[]>()
  for (const reminder of pending) {
    const key = reminderDayKey(reminder.due_at)
    byDay.set(key, [...(byDay.get(key) ?? []), reminder])
  }
  const overdue = pending.filter((reminder) => reminderDayKey(reminder.due_at) < todayKey).length

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() + index * DAY_MS)
    const key = reminderDayKey(date)
    return { key, label: formatDate(date, 'EEEE d'), items: byDay.get(key) ?? [] }
  })

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-xl">
          <CalendarDays className="size-5 text-primary" />
          Votre semaine
        </CardTitle>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {formatDate(now, 'MMMM yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {overdue > 0 && (
            <li className="flex items-center justify-between rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              <span>En retard</span>
              <span className="tabular-nums">{overdue}</span>
            </li>
          )}
          {days.map((day, index) => (
            <li
              key={day.key}
              className={cn(
                'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm',
                index === 0 && 'bg-secondary font-semibold text-secondary-foreground'
              )}
              title={day.items.map((item) => item.title).join('\n') || undefined}
            >
              <span className="capitalize">{index === 0 ? `Aujourd’hui · ${day.label}` : day.label}</span>
              {day.items.length === 0 ? (
                <span className="text-muted-foreground" aria-label="Aucune relance">
                  –
                </span>
              ) : (
                <span className="flex items-center gap-1" aria-label={`${day.items.length} relance(s)`}>
                  {day.items.slice(0, MAX_DOTS).map((item) => (
                    <span key={item.id} className="size-2 rounded-full bg-primary" />
                  ))}
                  {day.items.length > MAX_DOTS && (
                    <span className="text-xs font-medium text-muted-foreground">+{day.items.length - MAX_DOTS}</span>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
