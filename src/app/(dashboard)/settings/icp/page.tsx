import { Card, CardContent } from '@/components/ui/card'
import { IcpForm } from '@/components/settings/icp-form'
import { getIcpSettings } from '@/lib/queries/icp'
import { getCurrentPlan } from '@/lib/queries/billing'
import { PLAN_LIMITS } from '@/lib/billing'
import { ProOnlyNotice } from '@/components/billing/pro-only-notice'
import { hasAiAccess } from '@/lib/queries/ai-access'

export default async function IcpSettingsPage() {
  const [settings, plan, aiKey] = await Promise.all([getIcpSettings(), getCurrentPlan(), hasAiAccess()])
  const maxKeywords = PLAN_LIMITS[plan ?? 'pro'].searchKeywords

  return (
    <div className="space-y-6 max-w-4xl">

      <div>
        <h1 className="text-3xl font-bold">Client idéal</h1>
      </div>

      {plan === 'essentiel' && (
        <ProOnlyNotice>
          Offre Essentiel : {maxKeywords} mots-clés de recherche. L&apos;offre Pro en permet{' '}
          {PLAN_LIMITS.pro.searchKeywords}.
        </ProOnlyNotice>
      )}

      {settings ? (
        <IcpForm
          // Nouvelle recommandation appliquée : le formulaire repart des nouvelles valeurs recommandées
          key={settings.recommendation?.generatedAt ?? 'no-recommendation'}
          maxKeywords={maxKeywords}
          icp={settings.icp}
          signals={settings.signals}
          companiesCount={settings.companiesCount}
          professionKey={settings.professionKey}
          suggestedKeywords={settings.suggestedKeywords}
          recommendation={settings.recommendation}
          services={settings.services}
          hasAiKey={aiKey}
        />
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Aucun client idéal n&apos;est encore défini pour votre compte. Il est créé quand vous choisissez votre
            métier à l&apos;onboarding.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
