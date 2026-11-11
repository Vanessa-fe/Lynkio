'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { plans } from '@/components/landing/content'
import { startCheckout } from '@/lib/actions/billing'
import type { BillingInterval, PlanKey } from '@/lib/billing'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { cn } from '@/lib/utils/cn'

const euros = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount)

/**
 * Les deux offres, en mensuel ou en annuel : le bouton ouvre la page de paiement de Stripe.
 * firstChargeLabel : pendant l'essai, date du premier prélèvement (la fin de l'essai).
 */
export function PlanPicker({ firstChargeLabel }: { firstChargeLabel?: string }) {
  const [interval, setInterval] = useState<BillingInterval>('month')
  const [pending, setPending] = useState<PlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  const choose = async (plan: PlanKey) => {
    setError(null)
    setPending(plan)
    try {
      const result = await startCheckout(plan, interval)
      if (result.url) {
        // On reste sur « chargement » jusqu'à l'arrivée sur Stripe
        window.location.assign(result.url)
        return
      }
      setError(result.error ?? 'Le paiement est indisponible pour le moment.')
    } catch {
      setError(CONNECTION_ERROR)
    }
    setPending(null)
  }

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Période de paiement" className="inline-flex rounded-full border bg-card p-1">
        {(
          [
            { value: 'month', label: 'Mensuel' },
            { value: 'year', label: 'Annuel · 2 mois offerts' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={interval === option.value}
            onClick={() => setInterval(option.value)}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              interval === option.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const price = interval === 'year' ? plan.yearly : plan.monthly
          return (
            <Card key={plan.key} className={cn('flex flex-col', plan.highlighted && 'border-primary shadow-md')}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  {plan.highlighted && (
                    <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Recommandée
                    </span>
                  )}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
                <p className="flex items-baseline gap-2 pt-3">
                  <span className="text-4xl font-bold tracking-tight">{euros(price)}</span>
                  <span className="text-muted-foreground">{interval === 'year' ? 'par an' : 'par mois'}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {interval === 'year' ? `soit ${euros(plan.yearly / 12)} par mois` : `ou ${euros(plan.yearly)} par an`}
                </p>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-6">
                <ul className="flex-1 space-y-2.5 text-sm">
                  {plan.features.map((feature, index) => {
                    const intro = plan.key === 'pro' && index === 0
                    return (
                      <li key={feature} className={cn('flex gap-2.5', intro && 'font-semibold')}>
                        {!intro && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} aria-hidden />}
                        {feature}
                      </li>
                    )
                  })}
                </ul>
                <Button
                  type="button"
                  size="lg"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  onClick={() => choose(plan.key)}
                  disabled={pending !== null}
                >
                  {pending === plan.key && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {pending === plan.key ? 'Ouverture du paiement…' : `Choisir ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Paiement sécurisé par Stripe, par carte bancaire. Sans engagement : vous changez d&apos;offre ou vous arrêtez
        quand vous voulez.{firstChargeLabel ? ` Vous gardez votre essai : premier prélèvement le ${firstChargeLabel}.` : ''}
      </p>
    </div>
  )
}
