'use client'

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { openBillingPortal } from '@/lib/actions/billing'
import { CONNECTION_ERROR } from '@/lib/constants/errors'

/** Ouvre l'espace client Stripe : changer d'offre ou de carte, factures, résiliation */
export function ManageSubscriptionButton({ label = 'Gérer mon abonnement', variant = 'default' }: { label?: string; variant?: ButtonProps['variant'] }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const open = async () => {
    setError(null)
    setPending(true)
    try {
      const result = await openBillingPortal()
      if (result.url) {
        window.location.assign(result.url)
        return
      }
      setError(result.error ?? 'L’espace client est indisponible pour le moment.')
    } catch {
      setError(CONNECTION_ERROR)
    }
    setPending(false)
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} onClick={open} disabled={pending}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
        {pending ? 'Ouverture…' : label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
