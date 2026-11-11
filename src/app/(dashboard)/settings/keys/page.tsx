import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ApiKeysSettings } from '@/components/settings/api-keys-settings'
import { getMyAiProvider, getMyApiKeys } from '@/lib/queries/api-keys'

export default async function ApiKeysSettingsPage() {
  const [savedKeys, aiProvider] = await Promise.all([getMyApiKeys(), getMyAiProvider()])

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Vos clés</h1>
        <p className="text-muted-foreground mt-2">
          Sophie utilise vos propres comptes pour l&apos;IA et la recherche d&apos;e-mails : vous payez directement chaque
          service, au prix coûtant, sans intermédiaire. Les recherches d&apos;entreprises (offres d&apos;emploi,
          créations) et le suivi de vos prospects n&apos;ont besoin d&apos;aucune clé.
        </p>
      </div>

      <p className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        <span>
          Vos clés sont vérifiées puis chiffrées. Filonea ne les affiche plus jamais (seulement leurs 4 derniers
          caractères) et ne s&apos;en sert que pour les demandes que vous faites à Sophie.
        </span>
      </p>

      <ApiKeysSettings savedKeys={savedKeys} aiProvider={aiProvider} />
    </div>
  )
}
