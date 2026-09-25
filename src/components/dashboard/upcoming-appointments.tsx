import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { AppointmentWithContact } from '@/types'
import { Calendar, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { appointmentStatusLabels, appointmentStatusColors } from '@/lib/validations/appointment'

interface UpcomingAppointmentsProps {
  appointments: AppointmentWithContact[]
}

export function UpcomingAppointments({ appointments }: UpcomingAppointmentsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Prochains rendez-vous</CardTitle>
        <CardDescription>Vos rendez-vous à venir</CardDescription>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Aucun rendez-vous à venir
          </p>
        ) : (
          <div className="space-y-3">
            {appointments.map((appointment) => {
              const contactName =
                [appointment.contact.first_name, appointment.contact.last_name]
                  .filter(Boolean)
                  .join(' ') || 'Sans nom'

              const startDate = new Date(appointment.start_at)

              return (
                <Link
                  key={appointment.id}
                  href={`/appointments`}
                  className="flex items-start justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{appointment.title}</p>
                      <p className="text-sm text-muted-foreground">{contactName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {format(startDate, 'EEEE d MMMM à HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <Badge className={appointmentStatusColors[appointment.status ?? 'scheduled']}>
                    {appointmentStatusLabels[appointment.status ?? 'scheduled']}
                  </Badge>
                </Link>
              )
            })}
            <Link href="/appointments">
              <Button variant="outline" size="sm" className="w-full">
                Voir tous les rendez-vous
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
