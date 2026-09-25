'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { deleteContact, toggleFavorite } from '@/lib/actions/contacts'
import { useToast } from '@/lib/hooks/use-toast'
import type { ContactWithRelations } from '@/types'
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Star,
  Edit,
  Trash2,
  ArrowLeft,
  MessageSquare,
  AlertTriangle,
  ShieldAlert,
  Ban,
  User,
  Tag,
  FileText,
} from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ContactChannels } from './contact-channels'
import { InteractionsTimeline } from '@/components/interactions/interactions-timeline'
import { AppointmentFormDialog } from '@/components/appointments/appointment-form-dialog'
import { AppointmentCard } from '@/components/appointments/appointment-card'
import type { Interaction, Appointment, Payment } from '@/types'
import { PaymentFormDialog } from '@/components/payments/payment-form-dialog'
import { DollarSign } from 'lucide-react'
import { paymentStatusLabels, paymentMethodLabels } from '@/lib/validations/payment'

interface ContactDetailProps {
  contact: ContactWithRelations
  interactions: Interaction[]
  appointments: Appointment[]
  payments: Payment[]
}

const riskLevelIcons = {
  normal: null,
  monitor: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  insistent: <ShieldAlert className="w-5 h-5 text-orange-500" />,
  blocked: <Ban className="w-5 h-5 text-red-500" />,
}

const riskLevelLabels = {
  normal: 'Normal',
  monitor: 'À surveiller',
  insistent: 'Insistant',
  blocked: 'Bloqué',
}

const riskLevelDescriptions = {
  normal: 'Contact normal sans comportement suspect',
  monitor: 'Contact à surveiller - activité inhabituelle détectée',
  insistent: 'Contact insistant - nombreux messages/appels',
  blocked: 'Contact bloqué - comportement inapproprié',
}

export function ContactDetail({ contact, interactions, appointments, payments }: ContactDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Sans nom'

  const handleToggleFavorite = async () => {
    const result = await toggleFavorite(contact.id, !contact.favorite)

    if (result.success) {
      toast({
        title: 'Succès',
        description: contact.favorite
          ? 'Contact retiré des favoris'
          : 'Contact ajouté aux favoris',
      })
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${contactName} ?`)) {
      return
    }

    setIsDeleting(true)

    const result = await deleteContact(contact.id)

    if (result.success) {
      toast({
        title: 'Succès',
        description: 'Contact supprimé avec succès',
      })
      router.push('/contacts')
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <Link href="/contacts">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux contacts
          </Button>
        </Link>

        <div className="flex gap-2">
          <Link href={`/contacts/${contact.id}/edit`}>
            <Button variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleFavorite}
          >
            <Star
              className={`w-4 h-4 ${contact.favorite ? 'fill-yellow-400 text-yellow-400' : ''}`}
            />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Informations principales */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl flex items-center gap-3">
                {contactName}
                {contact.favorite && <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />}
              </CardTitle>
              {contact.nickname && (
                <CardDescription className="text-lg mt-1">&ldquo;{contact.nickname}&rdquo;</CardDescription>
              )}
            </div>
            {riskLevelIcons[contact.risk_level ?? 'normal']}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Statut et source */}
          <div className="flex flex-wrap gap-4">
            {contact.status && (
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: contact.status.color }}
                />
                <span className="font-medium">{contact.status.name}</span>
              </div>
            )}
            {contact.source && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Tag className="w-4 h-4" />
                <span>Source: {contact.source.name}</span>
              </div>
            )}
          </div>

          {/* Coordonnées */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contact.phone && (
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <a href={`tel:${contact.phone}`} className="font-medium hover:underline">
                    {contact.phone}
                  </a>
                </div>
              </div>
            )}

            {contact.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <a href={`mailto:${contact.email}`} className="font-medium hover:underline">
                    {contact.email}
                  </a>
                </div>
              </div>
            )}

            {contact.city && (
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Ville</p>
                  <p className="font-medium">{contact.city}</p>
                </div>
              </div>
            )}

            {contact.age && (
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Âge</p>
                  <p className="font-medium">{contact.age} ans</p>
                </div>
              </div>
            )}
          </div>

          {/* Niveau de risque */}
          {contact.risk_level !== 'normal' && (
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex items-start gap-3">
                {riskLevelIcons[contact.risk_level ?? 'normal']}
                <div>
                  <p className="font-semibold">{riskLevelLabels[contact.risk_level ?? 'normal']}</p>
                  <p className="text-sm text-muted-foreground">
                    {riskLevelDescriptions[contact.risk_level ?? 'normal']}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <p className="font-semibold">Notes</p>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-6 text-sm text-muted-foreground border-t pt-4">
            {contact.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>
                  Créé le {format(new Date(contact.created_at), 'dd MMMM yyyy', { locale: fr })}
                </span>
              </div>
            )}
            {contact.last_interaction_at && (
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                <span>
                  Dernière interaction le{' '}
                  {format(new Date(contact.last_interaction_at), 'dd MMMM yyyy', { locale: fr })}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Canaux de communication */}
      <ContactChannels contactId={contact.id} channels={contact.channels || []} />

      {/* Timeline des interactions */}
      <InteractionsTimeline contactId={contact.id} interactions={interactions} />

      {/* Rendez-vous */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rendez-vous</CardTitle>
              <CardDescription>Rendez-vous planifiés avec ce contact</CardDescription>
            </div>
            <AppointmentFormDialog contactId={contact.id} />
          </div>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Aucun rendez-vous planifié
            </p>
          ) : (
            <div className="space-y-3">
              {appointments.slice(0, 5).map((appointment) => (
                <AppointmentCard key={appointment.id} appointment={appointment} />
              ))}
              {appointments.length > 5 && (
                <Link href={`/appointments?contact=${contact.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Voir tous les rendez-vous ({appointments.length})
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Paiements */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Paiements</CardTitle>
              <CardDescription>Historique des paiements de ce contact</CardDescription>
            </div>
            <PaymentFormDialog contactId={contact.id} />
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">
              Aucun paiement enregistré
            </p>
          ) : (
            <div className="space-y-3">
              {payments.slice(0, 5).map((payment) => {
                const amount = typeof payment.amount === 'string'
                  ? parseFloat(payment.amount)
                  : payment.amount
                const depositAmount = typeof payment.deposit_amount === 'string'
                  ? parseFloat(payment.deposit_amount)
                  : (payment.deposit_amount ?? 0)

                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{amount.toFixed(2)} €</p>
                        <p className="text-sm text-muted-foreground">
                          {paymentStatusLabels[payment.payment_status ?? 'pending']}
                          {payment.payment_method && ` - ${paymentMethodLabels[payment.payment_method]}`}
                        </p>
                        {depositAmount > 0 && (
                          <p className="text-sm text-muted-foreground">
                            Acompte: {depositAmount.toFixed(2)} €
                          </p>
                        )}
                      </div>
                    </div>
                    {payment.paid_at && (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payment.paid_at), 'dd MMM yyyy', { locale: fr })}
                      </p>
                    )}
                  </div>
                )
              })}
              {payments.length > 5 && (
                <Link href="/payments">
                  <Button variant="outline" size="sm" className="w-full">
                    Voir tous les paiements ({payments.length})
                  </Button>
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
