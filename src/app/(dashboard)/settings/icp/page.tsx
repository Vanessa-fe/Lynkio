import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { IcpForm } from '@/components/settings/icp-form'
import { getIcpSettings } from '@/lib/queries/icp'

export default async function IcpSettingsPage() {
  const settings = await getIcpSettings()

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Client idéal</h1>
        <p className="text-muted-foreground mt-2">
          Ce qui compte pour vous dans une entreprise. Sophie s&apos;en sert pour noter chaque entreprise sur 100
          et vous montrer les plus prometteuses en premier.
        </p>
      </div>

      {settings ? (
        <IcpForm icp={settings.icp} signals={settings.signals} companiesCount={settings.companiesCount} />
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Aucun client idéal n&apos;est encore défini pour votre compte. Il est créé quand vous choisissez votre
            métier à l&apos;onboarding.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
