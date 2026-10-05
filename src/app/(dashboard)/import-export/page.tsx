import { CompaniesImport } from '@/components/import/companies-import'
import { CompaniesExport } from '@/components/import/companies-export'
import { WaalaxyExport } from '@/components/import/waalaxy-export'
import { getLeadSources } from '@/lib/queries/companies'
import { countWaalaxyContacts } from '@/lib/queries/waalaxy'
import { getProspectLists } from '@/lib/queries/people'

export default async function ImportExportPage() {
  const [sources, waalaxyCount, lists] = await Promise.all([getLeadSources(), countWaalaxyContacts(), getProspectLists()])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Import / Export</h1>
        <p className="text-muted-foreground mt-2">
          Ajoutez des entreprises et des personnes depuis un fichier CSV, ou récupérez les vôtres
        </p>
      </div>

      <CompaniesImport sources={sources} lists={lists} />
      <CompaniesExport />
      <WaalaxyExport count={waalaxyCount} />
    </div>
  )
}
