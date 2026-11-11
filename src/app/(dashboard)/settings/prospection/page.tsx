import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProspectionSettingsForm } from '@/components/prospection/prospection-settings-form'
import { getProspectionSettings } from '@/lib/queries/prospection'
import { getCurrentPlan } from '@/lib/queries/billing'
import { PLAN_LIMITS } from '@/lib/billing'
import { ProOnlyNotice } from '@/components/billing/pro-only-notice'

export default async function ProspectionSettingsPage() {
  const [settings, plan] = await Promise.all([getProspectionSettings(), getCurrentPlan()])
  const limits = PLAN_LIMITS[plan ?? 'pro']

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Recherche de Sophie</h1>
        <p className="text-muted-foreground mt-2">
          Où, quand et quoi chercher. Les résultats arrivent dans Entreprises, et l&apos;historique des recherches
          reste dans Prospection.
        </p>
      </div>

      {plan === 'essentiel' && (
        <ProOnlyNotice>
          Offre Essentiel : une recherche par semaine, {limits.companiesPerRun} entreprises au plus. Avec l&apos;offre
          Pro, Sophie cherche jusqu&apos;à 7 jours sur 7 et {PLAN_LIMITS.pro.companiesPerRun} entreprises par recherche.
        </ProOnlyNotice>
      )}

      <ProspectionSettingsForm settings={settings} maxDays={limits.daysPerWeek} maxCompanies={limits.companiesPerRun} />
    </div>
  )
}
