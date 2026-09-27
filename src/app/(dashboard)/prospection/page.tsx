import { ProspectionStatus } from '@/components/prospection/prospection-status'
import { ProspectionSettingsForm } from '@/components/prospection/prospection-settings-form'
import { PipelineRunsList } from '@/components/prospection/pipeline-runs-list'
import { getPipelineRuns, getProspectionSettings } from '@/lib/queries/prospection'

export default async function ProspectionPage() {
  const [settings, runs] = await Promise.all([getProspectionSettings(), getPipelineRuns()])
  const runningRun = runs.find((run) => run.status === 'running') ?? null

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Prospection</h1>
        <p className="text-muted-foreground mt-2">
          Sophie cherche pour vous les entreprises qui recrutent un développeur. Celles qu&apos;elle
          retient arrivent dans Entreprises, à l&apos;étape « À qualifier ».
        </p>
      </div>

      <ProspectionStatus settings={settings} runningRun={runningRun} />
      {/* Premier usage : les réglages d'abord, l'historique est encore vide */}
      {runs.length === 0 ? (
        <>
          <ProspectionSettingsForm settings={settings} />
          <PipelineRunsList runs={runs} />
        </>
      ) : (
        <>
          <PipelineRunsList runs={runs} />
          <ProspectionSettingsForm settings={settings} />
        </>
      )}
    </div>
  )
}
