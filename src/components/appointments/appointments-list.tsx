'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { deleteAppointment, updateAppointmentStatus } from '@/lib/actions/appointments'
import { useToast } from '@/lib/hooks/use-toast'
import type { AppointmentWithContact } from '@/lib/queries/appointments'
import {
  appointmentStatuses,
  appointmentStatusLabels,
  appointmentStatusColors,
  getAppointmentDuration,
  isAppointmentPast,
  isAppointmentToday,
} from '@/lib/validations/appointment'
import { Calendar, Clock, MapPin, User, Trash2, Eye } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AppointmentFormDialog } from './appointment-form-dialog'

interface AppointmentsListProps {
  appointments: AppointmentWithContact[]
  totalCount: number
}

export function AppointmentsList({ appointments, totalCount }: AppointmentsListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (appointmentId: string, title: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le rendez-vous "${title}" ?`)) {
      return
    }

    setDeletingId(appointmentId)

    const result = await deleteAppointment(appointmentId)

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    } else {
      toast({
        title: 'Succès',
        description: 'Rendez-vous supprimé avec succès',
      })
      router.refresh()
    }

    setDeletingId(null)
  }

  const handleStatusChange = async (appointmentId: string, status: string) => {
    const result = await updateAppointmentStatus(
      appointmentId,
      status as 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
    )

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    } else {
      toast({
        title: 'Succès',
        description: 'Statut mis à jour',
      })
      router.refresh()
    }
  }

  // Filtrer les rendez-vous
  const filteredAppointments = appointments.filter((appointment) => {
    if (statusFilter === 'all') return true
    return appointment.status === statusFilter
  })

  // Grouper par date
  const groupedAppointments = filteredAppointments.reduce(
    (groups, appointment) => {
      const date = format(new Date(appointment.start_at), 'yyyy-MM-dd')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date]?.push(appointment)
      return groups
    },
    {} as Record<string, AppointmentWithContact[]>
  )

  const sortedDates = Object.keys(groupedAppointments).sort()

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredAppointments.length} rendez-vous trouvé
            {filteredAppointments.length !== 1 ? 's' : ''} sur {totalCount}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {appointmentStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {appointmentStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <AppointmentFormDialog />
        </div>
      </div>

      {/* Liste des rendez-vous groupés par date */}
      {filteredAppointments.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Aucun rendez-vous trouvé</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((date) => {
            const dateAppointments = groupedAppointments[date]
            if (!dateAppointments) return null

            const dateObj = new Date(date)
            const isPast = isAppointmentPast(dateObj)
            const today = isAppointmentToday(dateObj)

            return (
              <div key={date}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {format(dateObj, 'EEEE d MMMM yyyy', { locale: fr })}
                  {today && <Badge variant="outline">Aujourd&apos;hui</Badge>}
                  {isPast && !today && <Badge variant="outline">Passé</Badge>}
                </h3>

                <div className="grid grid-cols-1 gap-4">
                  {dateAppointments.map((appointment) => {
                    const startDate = new Date(appointment.start_at)
                    const endDate = appointment.end_at ? new Date(appointment.end_at) : null
                    const duration = endDate ? getAppointmentDuration(startDate, endDate) : null
                    const contactName =
                      [appointment.contact.first_name, appointment.contact.last_name]
                        .filter(Boolean)
                        .join(' ') || 'Sans nom'

                    return (
                      <Card key={appointment.id} className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Heure */}
                          <div className="flex flex-col items-center min-w-[80px]">
                            <Clock className="w-5 h-5 text-muted-foreground mb-1" />
                            <span className="text-lg font-semibold">
                              {format(startDate, 'HH:mm')}
                            </span>
                            {endDate && (
                              <span className="text-sm text-muted-foreground">
                                {format(endDate, 'HH:mm')}
                              </span>
                            )}
                          </div>

                          {/* Détails */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div>
                                <h4 className="font-semibold text-lg">{appointment.title}</h4>
                                {duration && (
                                  <p className="text-sm text-muted-foreground">{duration}</p>
                                )}
                              </div>
                              <Select
                                value={appointment.status ?? 'scheduled'}
                                onValueChange={(value) => handleStatusChange(appointment.id, value)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {appointmentStatuses.map((status) => (
                                    <SelectItem key={status} value={status}>
                                      <span className={appointmentStatusColors[status]}>
                                        {appointmentStatusLabels[status]}
                                      </span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4" />
                                <Link
                                  href={`/contacts/${appointment.contact_id}`}
                                  className="hover:underline"
                                >
                                  {contactName}
                                </Link>
                              </div>

                              {appointment.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{appointment.location}</span>
                                </div>
                              )}
                            </div>

                            {appointment.notes && (
                              <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {appointment.notes}
                              </p>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 mt-3">
                              <Link href={`/contacts/${appointment.contact_id}`}>
                                <Button variant="outline" size="sm">
                                  <Eye className="w-4 h-4 mr-2" />
                                  Voir le contact
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(appointment.id, appointment.title)}
                                disabled={deletingId === appointment.id}
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
