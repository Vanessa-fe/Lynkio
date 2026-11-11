import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProspectionSettingsForm } from '@/components/prospection/prospection-settings-form'
import { getProspectionSettings } from '@/lib/queries/prospection'

export default async function ProspectionSettingsPage() {
  const settings = await getProspectionSettings()

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

      <ProspectionSettingsForm settings={settings} />
    </div>
  )
}
