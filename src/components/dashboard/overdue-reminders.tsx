import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ReminderWithRelations } from '@/types'
import { AlertCircle, Clock } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { reminderPriorityLabels, reminderPriorityBadgeVariants } from '@/lib/validations/reminder'

interface OverdueRemindersProps {
  reminders: ReminderWithRelations[]
}

export function OverdueReminders({ reminders }: OverdueRemindersProps) {
  return (
    <Card className="border-red-200 bg-red-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700">
          <AlertCircle className="w-5 h-5" />
          Relances en retard
        </CardTitle>
        <CardDescription>À traiter en priorité</CardDescription>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Aucune relance en retard
          </p>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => {
              const dueDate = new Date(reminder.due_at)
              const contactName = reminder.contact
                ? [reminder.contact.first_name, reminder.contact.last_name]
                    .filter(Boolean)
                    .join(' ') || 'Sans nom'
                : reminder.agency
                  ? reminder.agency.name
                  : 'Sans contact'

              return (
                <Link
                  key={reminder.id}
                  href="/reminders"
                  className="flex items-start justify-between p-3 rounded-lg border bg-white hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="font-medium text-red-700">{reminder.title}</p>
                      {(reminder.contact || reminder.agency) && (
                        <p className="text-sm text-muted-foreground">{contactName}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-red-500" />
                        <p className="text-xs text-red-600 font-medium">
                          En retard de{' '}
                          {formatDistanceToNow(dueDate, { locale: fr, addSuffix: false })}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Échéance: {format(dueDate, 'dd MMM yyyy à HH:mm', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={reminderPriorityBadgeVariants[reminder.priority ?? 'medium']}>
                    {reminderPriorityLabels[reminder.priority ?? 'medium']}
                  </Badge>
                </Link>
              )
            })}
            <Link href="/reminders">
              <Button variant="outline" size="sm" className="w-full">
                Voir toutes les relances
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
