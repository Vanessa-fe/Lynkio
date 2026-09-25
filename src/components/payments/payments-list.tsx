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
import { deletePayment } from '@/lib/actions/payments'
import { useToast } from '@/lib/hooks/use-toast'
import type { PaymentWithRelations } from '@/types'
import {
  paymentStatuses,
  paymentStatusLabels,
  paymentStatusColors,
  paymentMethodLabels,
  getRemainingAmount,
  getPaymentProgress,
} from '@/lib/validations/payment'
import { DollarSign, Calendar, CreditCard, Trash2, User, CalendarCheck } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { PaymentFormDialog } from './payment-form-dialog'

interface PaymentsListProps {
  payments: PaymentWithRelations[]
  totalCount: number
  contactId?: string
}

export function PaymentsList({ payments, totalCount, contactId }: PaymentsListProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (paymentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      return
    }

    setDeletingId(paymentId)

    const result = await deletePayment(paymentId)

    if (!result.success) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: result.error || 'Une erreur est survenue',
      })
    } else {
      toast({
        title: 'Succès',
        description: 'Paiement supprimé avec succès',
      })
      router.refresh()
    }

    setDeletingId(null)
  }

  // Filtrer les paiements
  const filteredPayments = payments.filter((payment) => {
    if (statusFilter === 'all') return true
    return payment.payment_status === statusFilter
  })

  return (
    <div className="space-y-6">
      {/* En-tête avec filtres */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            {filteredPayments.length} paiement{filteredPayments.length !== 1 ? 's' : ''} trouvé
            {filteredPayments.length !== 1 ? 's' : ''} sur {totalCount}
          </p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {paymentStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {paymentStatusLabels[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {contactId && <PaymentFormDialog contactId={contactId} />}
        </div>
      </div>

      {/* Liste des paiements */}
      {filteredPayments.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Aucun paiement trouvé</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredPayments.map((payment) => {
            const contactName =
              [payment.contact.first_name, payment.contact.last_name]
                .filter(Boolean)
                .join(' ') || 'Sans nom'

            const amount = typeof payment.amount === 'string'
              ? parseFloat(payment.amount)
              : payment.amount

            const depositAmount = typeof payment.deposit_amount === 'string'
              ? parseFloat(payment.deposit_amount)
              : (payment.deposit_amount ?? 0)

            const remaining = getRemainingAmount(amount, depositAmount)
            const progress = getPaymentProgress(amount, depositAmount)

            return (
              <Card key={payment.id} className="p-4">
                <div className="flex items-start gap-4">
                  {/* Montant */}
                  <div className="flex flex-col items-center min-w-[100px]">
                    <DollarSign className="w-5 h-5 text-muted-foreground mb-1" />
                    <span className="text-2xl font-bold">
                      {amount.toFixed(2)} €
                    </span>
                    {depositAmount > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Acompte: {depositAmount.toFixed(2)} €
                      </span>
                    )}
                  </div>

                  {/* Détails */}
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={paymentStatusColors[payment.payment_status ?? 'pending']}>
                            {paymentStatusLabels[payment.payment_status ?? 'pending']}
                          </Badge>
                          {payment.payment_method && (
                            <Badge variant="outline">
                              {paymentMethodLabels[payment.payment_method]}
                            </Badge>
                          )}
                        </div>
                        {remaining > 0 && (
                          <div className="mt-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                              <span>Reste à payer: {remaining.toFixed(2)} €</span>
                              <span>({progress.toFixed(0)}% payé)</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-green-600 h-2 rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <Link
                          href={`/contacts/${payment.contact_id}`}
                          className="hover:underline"
                        >
                          {contactName}
                        </Link>
                      </div>

                      {payment.appointment && (
                        <div className="flex items-center gap-2">
                          <CalendarCheck className="w-4 h-4" />
                          <span>Rendez-vous: {payment.appointment.title}</span>
                        </div>
                      )}

                      {payment.paid_at && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Payé le {format(new Date(payment.paid_at), 'dd MMMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      )}

                      {payment.payment_method && (
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4" />
                          <span>{paymentMethodLabels[payment.payment_method]}</span>
                        </div>
                      )}
                    </div>

                    {payment.notes && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                        {payment.notes}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(payment.id)}
                        disabled={deletingId === payment.id}
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
      )}
    </div>
  )
}
