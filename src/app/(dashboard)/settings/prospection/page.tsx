import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProspectionSettingsForm } from '@/components/prospection/prospection-settings-form'
import { TechResearchCard } from '@/components/prospection/tech-research-card'
import { getPipelineRuns, getProspectionSettings } from '@/lib/queries/prospection'
import { getIcpBasics } from '@/lib/queries/icp'
import { getCurrentPlan } from '@/lib/queries/billing'
import { PLAN_LIMITS } from '@/lib/billing'
import { ProOnlyNotice } from '@/components/billing/pro-only-notice'

export default async function ProspectionSettingsPage() {
  const [settings, plan, icp, runs] = await Promise.all([
    getProspectionSettings(),
    getCurrentPlan(),
    getIcpBasics(),
    getPipelineRuns(5),
  ])
  const limits = PLAN_LIMITS[plan ?? 'pro']
  const isRunning = runs.some((run) => run.status === 'running')

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

      {/* Recherche par technologie : seulement pour la tech (ou des technologies déjà choisies) */}
      {(icp.professionKey === 'web_developer' || icp.techStack.length > 0) && (
        <TechResearchCard techStack={icp.techStack} isRunning={isRunning} proOnly={!limits.techResearch} />
      )}
    </div>
  )
}
