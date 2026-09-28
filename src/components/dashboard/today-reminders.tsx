'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { completeReminder } from '@/lib/actions/reminders'
import { useToast } from '@/lib/hooks/use-toast'
import type { ReminderWithRelations } from '@/types'
import { formatDate, isSameParisDay } from '@/lib/utils/dates'

function reminderTarget(reminder: ReminderWithRelations): { href: string; label: string } | null {
  if (reminder.company) return { href: `/companies/${reminder.company.id}`, label: reminder.company.name }
  return null
}

export function TodayReminders({ reminders }: { reminders: ReminderWithRelations[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [completingId, setCompletingId] = useState<string | null>(null)

  const handleComplete = async (reminder: ReminderWithRelations) => {
    setCompletingId(reminder.id)
    const result = await completeReminder(reminder.id)
    setCompletingId(null)

    if (result.success) {
      toast({ title: 'Relance faite', description: reminder.title })
      router.refresh()
    } else {
      toast({ variant: 'destructive', title: 'Erreur', description: result.error })
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>À faire aujourd&apos;hui</CardTitle>
            <CardDescription>Relances du jour et en retard</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/reminders">Toutes les relances</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {reminders.length === 0 ? (
          <div className="flex items-center gap-3 text-muted-foreground py-4">
            <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
            <p className="text-sm">Aucune relance pour aujourd&apos;hui.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {reminders.map((reminder) => {
              const due = new Date(reminder.due_at)
              const overdue = !isSameParisDay(due, new Date()) && due < new Date()
              const target = reminderTarget(reminder)

              return (
                <li key={reminder.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Checkbox
                    className="mt-1"
                    checked={false}
                    disabled={completingId === reminder.id}
                    onCheckedChange={() => handleComplete(reminder)}
                    aria-label={`Marquer « ${reminder.title} » comme faite`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{reminder.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {target && (
                        <>
                          <Link href={target.href} className="hover:underline">
                            {target.label}
                          </Link>
                          {' · '}
                        </>
                      )}
                      <span className={overdue ? 'text-destructive font-medium' : undefined}>
                        {overdue
                          ? `En retard depuis le ${formatDate(due, 'd MMMM')}`
                          : `Aujourd'hui à ${formatDate(due, 'HH:mm')}`}
                      </span>
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
