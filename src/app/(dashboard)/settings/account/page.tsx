import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeleteAccount } from '@/components/settings/delete-account'
import { getAuthUser } from '@/lib/supabase/auth'

export default async function AccountSettingsPage() {
  const user = await getAuthUser()

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
            Téléchargez à tout moment vos entreprises, leurs contacts et leur suivi, dans un fichier lisible par un
            tableur (Excel, Google Sheets).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/api/export/companies" download>
              <Download className="w-4 h-4 mr-2" />
              Exporter mes entreprises
            </a>
          </Button>
        </CardContent>
      </Card>

      <DeleteAccount />
    </div>
  )
}
