'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { completeReminder, uncompleteReminder, deleteReminder } from '@/lib/actions/reminders'
import { useToast } from '@/lib/hooks/use-toast'
import type { ReminderWithRelations } from '@/types'
import {
  reminderPriorities,
  reminderPriorityLabels,
  reminderPriorityBadgeVariants,
  getReminderUrgency,
  isReminderOverdue,
} from '@/lib/validations/reminder'
import { Clock, Building2, Trash2, AlertCircle } from 'lucide-react'
import { ReminderFormDialog } from './reminder-form-dialog'
import { formatDate } from '@/lib/utils/dates'

interface RemindersListProps {
  reminders: ReminderWithRelations[]
  totalCount: number
  companyId?: string
  // Entreprises proposées à la création d'une relance (page Relances)
  companies?: { id: string; name: string }[]
}

export function RemindersList({
  reminders,
  totalCount,
  companyId,
  companies,
}: RemindersListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleToggleComplete = async (reminderId: string, isCompleted: boolean) => {
    const result = isCompleted
      ? await uncompleteReminder(reminderId)
      : await completeReminder(reminderId)

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    } else {
      router.refresh()
    }
  }

  const handleDelete = async (reminderId: string, title: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer la relance "${title}" ?`)) {
      return
    }

    setDeletingId(reminderId)

    const result = await deleteReminder(reminderId)

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    } else {
      toast({
        title: 'Succès',
        description: 'Relance supprimée avec succès',
      })
      router.refresh()
    }

    setDeletingId(null)
  }

  // Filtrer les relances
  const filteredReminders = reminders.filter((reminder) => {
    if (statusFilter === 'pending' && reminder.completed_at) return false
    if (statusFilter === 'completed' && !reminder.completed_at) return false
    if (priorityFilter !== 'all' && reminder.priority !== priorityFilter) return false
    return true
  })

  // Grouper par urgence
  const groupedReminders = filteredReminders.reduce(
    (groups, reminder) => {
      const urgency = getReminderUrgency(
        new Date(reminder.due_at),
        reminder.priority ?? 'medium',
        reminder.completed_at ? new Date(reminder.completed_at) : null
      )
      if (!groups[urgency]) {
        groups[urgency] = []
      }
      groups[urgency]?.push(reminder)
      return groups
    },
    {} as Record<string, ReminderWithRelations[]>
  )

  const urgencyLabels = {
    overdue: 'En retard',
    urgent: 'Urgent',
    upcoming: 'À venir',
    completed: 'Terminé',
  }

  const urgencyOrder = ['overdue', 'urgent', 'upcoming', 'completed']

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredReminders.length} relance{filteredReminders.length !== 1 ? 's' : ''} trouvée
            {filteredReminders.length !== 1 ? 's' : ''} sur {totalCount}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">En cours</SelectItem>
              <SelectItem value="completed">Terminées</SelectItem>
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Priorité" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              {reminderPriorities.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {reminderPriorityLabels[priority]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <ReminderFormDialog
            companyId={companyId}
            companies={companies}
          />
        </div>
      </div>

      {/* Liste des relances groupées par urgence */}
      {filteredReminders.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Aucune relance trouvée</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {urgencyOrder.map((urgency) => {
            const urgencyReminders = groupedReminders[urgency]
            if (!urgencyReminders || urgencyReminders.length === 0) return null

            return (
              <div key={urgency}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {urgency === 'overdue' && <AlertCircle className="w-5 h-5 text-red-500" />}
                  {urgencyLabels[urgency as keyof typeof urgencyLabels]}
                  <Badge variant="outline">{urgencyReminders.length}</Badge>
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {urgencyReminders.map((reminder) => {
                    const dueDate = new Date(reminder.due_at)
                    const isOverdue = isReminderOverdue(dueDate, reminder.completed_at ? new Date(reminder.completed_at) : null)
                    const isCompleted = !!reminder.completed_at

                    return (
                      <Card
                        key={reminder.id}
                        className={`p-4 ${isCompleted ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Checkbox */}
                          <div className="pt-1">
                            <Checkbox
                              checked={isCompleted}
                              onCheckedChange={() => handleToggleComplete(reminder.id, isCompleted)}
                            />
                          </div>

                          {/* Détails */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <h4
                                  className={`font-semibold ${
                                    isCompleted ? 'line-through text-muted-foreground' : ''
                                  }`}
                                >
                                  {reminder.title}
                                </h4>
                              </div>
                              <Badge
                                variant={reminderPriorityBadgeVariants[reminder.priority ?? 'medium']}
                              >
                                {reminderPriorityLabels[reminder.priority ?? 'medium']}
                              </Badge>
                            </div>

                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className={isOverdue ? 'text-red-500 font-medium' : ''}>
                                  {formatDate(dueDate, 'dd MMMM yyyy à HH:mm')}
                                  {isOverdue && !isCompleted && ' - En retard'}
                                </span>
                              </div>

                              {reminder.company && !companyId && (
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4" />
                                  <Link
                                    href={`/companies/${reminder.company.id}`}
                                    className="hover:underline"
                                  >
                                    {reminder.company.name}
                                  </Link>
                                </div>
                              )}

                              {isCompleted && reminder.completed_at && (
                                <div className="flex items-center gap-2 text-green-600">
                                  <span>
                                    Terminé le{' '}
                                    {formatDate(new Date(reminder.completed_at), 'dd MMMM yyyy')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 mt-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(reminder.id, reminder.title)}
                                disabled={deletingId === reminder.id}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
