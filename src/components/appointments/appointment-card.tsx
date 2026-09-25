'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Appointment } from '@/types'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  appointmentStatusLabels,
  appointmentStatusColors,
  getAppointmentDuration,
} from '@/lib/validations/appointment'

interface AppointmentCardProps {
  appointment: Appointment
}

export function AppointmentCard({ appointment }: AppointmentCardProps) {
  const startDate = new Date(appointment.start_at)
  const endDate = appointment.end_at ? new Date(appointment.end_at) : null
  const duration = endDate ? getAppointmentDuration(startDate, endDate) : null

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold">{appointment.title}</h4>
            <Badge className={appointmentStatusColors[appointment.status ?? 'scheduled']}>
              {appointmentStatusLabels[appointment.status ?? 'scheduled']}
            </Badge>
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{format(startDate, 'EEEE d MMMM yyyy', { locale: fr })}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>
                {format(startDate, 'HH:mm', { locale: fr })}
                {endDate && ` - ${format(endDate, 'HH:mm', { locale: fr })}`}
                {duration && ` (${duration})`}
              </span>
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
        </div>
      </div>
    </Card>
  )
}
