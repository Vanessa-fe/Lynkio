import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OfferForm } from '@/components/settings/offer-form'
import { getOffer } from '@/lib/queries/offer'
import { getIcpBasics } from '@/lib/queries/icp'

export default async function OfferSettingsPage() {
  const [offer, icp] = await Promise.all([getOffer(), getIcpBasics()])

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/settings">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Paramètres
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Mon offre et mes objectifs</h1>
        <p className="text-muted-foreground mt-2">
          Ce que vous proposez, comment vous travaillez et ce que vous visez. Tout est à vous : rien n’est imposé.
        </p>
      </div>

      {offer ? (
        <OfferForm offer={offer} dayRate={icp.dayRate} />
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Votre client idéal n’est pas encore créé : choisissez d’abord votre métier.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
