import { ProspectionStatus } from '@/components/prospection/prospection-status'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { PipelineRunsList } from '@/components/prospection/pipeline-runs-list'
import { UnidentifiedOffers } from '@/components/prospection/unidentified-offers'
import { StrategiesCard } from '@/components/prospection/strategies-card'
import { getStrategies } from '@/lib/queries/strategies'
import { JOB_OFFERS_ENABLED } from '@/lib/constants/features'
import { getIcpBasics } from '@/lib/queries/icp'
import { getCurrentPlan } from '@/lib/queries/billing'
import { PLAN_LIMITS } from '@/lib/billing'
import {
  getCompanyChoices,
  getNextScheduledRun,
  getPipelineRuns,
  getProspectionSettings,
  getUnidentifiedOffers,
  getWeeklyRunAvailableAt,
} from '@/lib/queries/prospection'

export default async function ProspectionPage() {
  const [settings, runs, unidentifiedOffers, companyChoices, icp, plan, strategies] = await Promise.all([
    getProspectionSettings(),
    getPipelineRuns(),
    getUnidentifiedOffers(),
    getCompanyChoices(),
    getIcpBasics(),
    getCurrentPlan(),
    getStrategies(),
  ])
  const runningRun = runs.find((run) => run.status === 'running') ?? null
  // Offre Essentiel : une recherche par semaine, et la prochaine automatique peut être sautée
  const availableAt = await getWeeklyRunAvailableAt(plan)
  const nextRunAt = await getNextScheduledRun(settings, availableAt)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Prospection</h1>
        <p className="text-muted-foreground mt-2">
          Sophie cherche pour vous les entreprises qui correspondent à votre profil de client, dans le registre
          officiel des entreprises.
          Celles qu&apos;elle retient arrivent dans Entreprises, à l&apos;étape « À qualifier ».
        </p>
      </div>

      <ProspectionStatus
        settings={settings}
        nextRunAt={nextRunAt}
        runningRun={runningRun}
        weeklyRunAvailableAt={availableAt}
      />
      <StrategiesCard
        strategies={strategies}
        professionKey={icp.professionKey}
        defaultDepartments={settings?.departments ?? []}
        isRunning={!!runningRun}
        maxStrategies={PLAN_LIMITS[plan ?? 'pro'].strategies}
      />
      {JOB_OFFERS_ENABLED && <UnidentifiedOffers offers={unidentifiedOffers} companies={companyChoices} />}
      {/* Premier usage : un rappel bien visible pour régler la recherche, l'historique est encore vide */}
      <Link
        href="/settings/prospection"
        className="flex items-center gap-3 rounded-lg border bg-card p-4 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Settings2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="font-medium">Réglages de la recherche</span>
          <span className="block text-muted-foreground">
            {runs.length === 0
              ? 'Commencez par choisir vos départements, vos jours et ce que Sophie doit chercher.'
              : 'Départements, jours, nombre d’entreprises et secteurs ignorés : dans Paramètres.'}
          </span>
        </span>
      </Link>
      <PipelineRunsList runs={runs} />
    </div>
  )
}
