import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AccessLog } from '@/components/settings/access-log'
import { DataRetentionSettings } from '@/components/settings/data-retention-settings'
import { DeleteAccount } from '@/components/settings/delete-account'
import { getAuthUser } from '@/lib/supabase/auth'
import { getDataRetentionOverview } from '@/lib/queries/data-retention'

export default async function AccountSettingsPage() {
  const user = await getAuthUser()
  const retention = user ? await getDataRetentionOverview(user.id) : null

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Mon compte</h1>
        <p className="text-muted-foreground mt-2">
          Connecté·e avec <span className="font-medium text-foreground break-all">{user?.email ?? 'votre adresse'}</span>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vos données</CardTitle>
          <CardDescription>
            Téléchargez à tout moment vos entreprises, leurs contacts et leur suivi dans un fichier lisible par un tableur
            (Excel, Google Sheets), ou l&apos;ensemble de vos données (réglages, échanges, listes, journal…) dans un
            fichier complet, pour les garder ou les reprendre ailleurs.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export/companies" download>
              <Download className="w-4 h-4 mr-2" />
              Exporter mes entreprises
            </a>
          </Button>
          <Button variant="outline" asChild>
            <a href="/api/export/account" download>
              <Download className="w-4 h-4 mr-2" />
              Exporter toutes mes données
            </a>
          </Button>
        </CardContent>
      </Card>

      {retention && <DataRetentionSettings settings={retention.settings} preview={retention.preview} />}
      {retention && <AccessLog entries={retention.accessLog} />}

      <DeleteAccount />
    </div>
  )
}
