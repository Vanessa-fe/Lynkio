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

      <div>
        <h1 className="text-3xl font-bold">Recherche de Sophie</h1>
      </div>

      {plan === 'essentiel' && (
        <ProOnlyNotice>
          Offre Essentiel : {limits.daysPerWeek} recherches par semaine, {limits.companiesPerRun} entreprises au plus ; une recherche
          sans résultat n&apos;est pas comptée. Avec l&apos;offre
          Pro, Sophie cherche jusqu&apos;à 7 jours sur 7 et {PLAN_LIMITS.pro.companiesPerRun} entreprises par recherche.
        </ProOnlyNotice>
      )}

      <ProspectionSettingsForm settings={settings} maxDays={limits.daysPerWeek} maxCompanies={limits.companiesPerRun} />
    </div>
  )
}
