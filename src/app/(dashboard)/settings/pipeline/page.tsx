import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PipelineStagesSettings } from '@/components/settings/pipeline-stages-settings'
import { LeadSourcesSettings } from '@/components/settings/lead-sources-settings'
import { getLeadSources, getPipelineStages, getPipelineUsage } from '@/lib/queries/companies'

export default async function PipelineSettingsPage() {
  const [stages, sources, usage] = await Promise.all([getPipelineStages(), getLeadSources(), getPipelineUsage()])

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Étapes et sources</h1>
        <p className="text-muted-foreground mt-2">
          Organisez votre pipeline de prospection comme vous travaillez.
        </p>
      </div>

      <PipelineStagesSettings stages={stages} usage={usage.byStage} />
      <LeadSourcesSettings sources={sources} usage={usage.bySource} />
    </div>
  )
}
