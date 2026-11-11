import { ProspectionStatus } from '@/components/prospection/prospection-status'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { PipelineRunsList } from '@/components/prospection/pipeline-runs-list'
import { UnidentifiedOffers } from '@/components/prospection/unidentified-offers'
import { TechResearchCard } from '@/components/prospection/tech-research-card'
import { getIcpBasics } from '@/lib/queries/icp'
import {
  getCompanyChoices,
  getPipelineRuns,
  getProspectionSettings,
  getUnidentifiedOffers,
} from '@/lib/queries/prospection'

export default async function ProspectionPage() {
  const [settings, runs, unidentifiedOffers, companyChoices, icp] = await Promise.all([
    getProspectionSettings(),
    getPipelineRuns(),
    getUnidentifiedOffers(),
    getCompanyChoices(),
    getIcpBasics(),
  ])
  const runningRun = runs.find((run) => run.status === 'running') ?? null

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Prospection</h1>
        <p className="text-muted-foreground mt-2">
          Sophie cherche pour vous les entreprises qui recrutent dans votre métier ou viennent d&apos;être créées.
          Celles qu&apos;elle retient arrivent dans Entreprises, à l&apos;étape « À qualifier ».
        </p>
      </div>

      <ProspectionStatus settings={settings} runningRun={runningRun} />
      {/* Recherche par technologie : seulement pour la tech (ou des technologies déjà choisies) */}
      {(icp.professionKey === 'web_developer' || icp.techStack.length > 0) && (
        <TechResearchCard techStack={icp.techStack} isRunning={!!runningRun} />
      )}
      <UnidentifiedOffers offers={unidentifiedOffers} companies={companyChoices} />
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
              : 'Départements, jours, sources, intermédiaires acceptés et secteurs ignorés : dans Paramètres.'}
          </span>
        </span>
      </Link>
      <PipelineRunsList runs={runs} />
    </div>
  )
}
