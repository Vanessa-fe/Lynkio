import Link from 'next/link'
import { AlertTriangle, Hourglass } from 'lucide-react'
import type { Access } from '@/lib/billing'
import { cn } from '@/lib/utils/cn'

/** Bandeau du tableau de bord : jours d'essai restants, ou paiement à régulariser */
export function BillingBanner({ access }: { access: Access }) {
  if (access.kind !== 'trial' && !access.paymentIssue) return null
  const urgent = access.paymentIssue || access.trialDaysLeft <= 3

  return (
    <div
      role="status"
      className={cn(
        'mb-6 flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        urgent ? 'border-primary/40 bg-primary/5' : 'bg-card'
      )}
    >
      <p className="flex items-center gap-2">
        {access.paymentIssue ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <Hourglass className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        )}
        {access.paymentIssue
          ? 'Le dernier paiement n’est pas passé : mettez à jour votre carte pour garder votre accès.'
          : `Essai gratuit de l’offre Pro : encore ${access.trialDaysLeft} jour${access.trialDaysLeft > 1 ? 's' : ''}.`}
      </p>
      <Link href="/billing" className="shrink-0 font-medium text-primary underline-offset-4 hover:underline">
        {access.paymentIssue ? 'Mettre à jour ma carte' : 'Choisir mon offre'}
      </Link>
    </div>
  )
}
