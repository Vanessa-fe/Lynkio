import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Gift, Hourglass } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogoutButton } from '@/components/layout/logout-button'
import { DeleteAccount } from '@/components/settings/delete-account'
import { PlanPicker } from '@/components/billing/plan-picker'
import { ManageSubscriptionButton } from '@/components/billing/manage-subscription-button'
import { getAuthUser } from '@/lib/supabase/auth'
import { getBilling } from '@/lib/queries/billing'
import { syncBilling } from '@/lib/actions/billing'
import { getAccess, PLAN_LABELS, type PlanKey } from '@/lib/billing'

export const metadata: Metadata = { title: 'Abonnement', robots: { index: false } }

const longDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(
    new Date(iso)
  )

// Page hors du tableau de bord : elle reste ouverte quand l'essai est terminé
export default async function BillingPage({ searchParams }: { searchParams: Promise<{ paiement?: string; maj?: string }> }) {
  const user = await getAuthUser()
  if (!user) redirect('/login?redirect=/billing')

  const { paiement, maj } = await searchParams
  // Retour de Stripe (paiement ou espace client) : on recopie l'abonnement sans attendre sa notification
  if (paiement === 'ok' || maj === '1') await syncBilling()

  const billing = await getBilling()
  const access = getAccess(billing)
  const subscribed = access.kind === 'subscription'
  const plan = billing?.plan === 'essentiel' || billing?.plan === 'pro' ? (billing.plan as PlanKey) : null
  const periodEnd = billing?.current_period_end ? longDate(billing.current_period_end) : null
  const trialEnd = billing ? longDate(billing.trial_ends_at) : null
  const keepsTrial = access.keepsTrial
  const endedSubscription = billing?.status === 'canceled' || billing?.status === 'unpaid' || billing?.status === 'incomplete_expired'

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 md:px-8">
          <Logo href={access.allowed ? '/dashboard' : '/billing'} />
          <div className="flex items-center gap-1">
            {access.allowed && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Paramètres
                </Link>
              </Button>
            )}
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 p-4 pb-16 md:p-8">
        <div>
          <h1 className="text-3xl font-bold">Abonnement</h1>
          <p className="mt-2 text-muted-foreground">
            Compte <span className="break-all font-medium text-foreground">{user.email ?? 'connecté'}</span>
          </p>
        </div>

        {paiement === 'ok' && subscribed && (
          <div role="status" className="flex gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            <p>
              Merci ! Votre abonnement {plan ? PLAN_LABELS[plan] : ''}{' '}
              {billing?.status === 'trialing' ? 'est enregistré.' : 'est actif.'} Vos factures sont dans « Gérer mon
              abonnement ».{' '}
              <Link href="/dashboard" className="font-medium underline underline-offset-4">
                Retour au tableau de bord
              </Link>
            </p>
          </div>
        )}
        {paiement === 'ok' && !subscribed && (
          <div role="status" className="flex gap-3 rounded-xl border bg-muted/50 p-4 text-sm">
            <Hourglass className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <p>Paiement reçu, Stripe nous le confirme dans un instant : rechargez la page dans quelques secondes.</p>
          </div>
        )}

        {access.kind === 'exempt' && (
          <Card>
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <Gift className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1.5">
                <CardTitle>Votre compte est offert</CardTitle>
                <CardDescription>Toutes les fonctions de l&apos;offre Pro, sans abonnement à payer.</CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {subscribed && (
          <Card className={access.paymentIssue ? 'border-destructive/50' : undefined}>
            <CardHeader>
              <CardTitle>
                Offre {plan ? PLAN_LABELS[plan] : ''}
                {billing?.billing_interval ? ` · ${billing.billing_interval === 'year' ? 'annuelle' : 'mensuelle'}` : ''}
              </CardTitle>
              <CardDescription>
                {access.paymentIssue
                  ? 'Le dernier paiement n’est pas passé. Mettez à jour votre carte pour garder votre accès : Stripe retente le prélèvement dans les prochains jours.'
                  : billing?.cancel_at_period_end && periodEnd
                    ? `Abonnement résilié : vous gardez l’accès jusqu’au ${periodEnd}, sans prélèvement. Vous pouvez le reprendre d’ici là.`
                    : billing?.status === 'trialing' && periodEnd
                      ? `Votre essai continue : premier prélèvement le ${periodEnd}.`
                      : periodEnd
                        ? `Prochain prélèvement le ${periodEnd}.`
                        : 'Abonnement actif.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ManageSubscriptionButton
                label={access.paymentIssue ? 'Mettre à jour ma carte' : 'Gérer mon abonnement'}
                variant={access.paymentIssue ? 'destructive' : 'default'}
              />
              <p className="text-sm text-muted-foreground">
                Sur l&apos;espace sécurisé de Stripe : changer d&apos;offre ou de carte, télécharger vos factures, résilier.
              </p>
            </CardContent>
          </Card>
        )}

        {access.kind === 'trial' && (
          <Card>
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <Hourglass className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1.5">
                <CardTitle>
                  Essai gratuit : encore {access.trialDaysLeft} jour{access.trialDaysLeft > 1 ? 's' : ''}
                </CardTitle>
                <CardDescription>
                  Toutes les fonctions de l&apos;offre Pro jusqu&apos;au {trialEnd}. Choisissez votre offre quand vous voulez
                  {keepsTrial ? ' : les jours d’essai restants sont gardés, rien n’est prélevé avant leur fin.' : '.'}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {access.kind === 'expired' && (
          <Card className="border-primary/40">
            <CardHeader className="flex-row items-start gap-3 space-y-0">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <div className="space-y-1.5">
                <CardTitle>{endedSubscription ? 'Votre abonnement a pris fin' : 'Votre essai gratuit est terminé'}</CardTitle>
                <CardDescription>
                  Choisissez une offre pour continuer : vos entreprises, vos contacts et vos réglages vous attendent.
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        )}

        {!subscribed && access.kind !== 'exempt' && (
          <section aria-labelledby="offres" className="space-y-4">
            <h2 id="offres" className="text-xl font-semibold">
              Nos offres
            </h2>
            <PlanPicker firstChargeLabel={keepsTrial && trialEnd ? trialEnd : undefined} />
          </section>
        )}

        {!access.allowed && (
          <section aria-labelledby="donnees" className="space-y-4">
            <h2 id="donnees" className="text-xl font-semibold">
              Vos données
            </h2>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Elles restent à vous</CardTitle>
                <CardDescription>
                  Téléchargez vos entreprises, leurs contacts et leur suivi, même sans abonnement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" asChild>
                  <a href="/api/export/companies" download>
                    <Download className="mr-2 h-4 w-4" />
                    Exporter mes entreprises
                  </a>
                </Button>
              </CardContent>
            </Card>
            <DeleteAccount />
          </section>
        )}
      </main>
    </div>
  )
}
