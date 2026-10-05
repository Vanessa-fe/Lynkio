import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'

/**
 * Export des contacts pour une campagne Waalaxy (profils LinkedIn uniquement)
 */
export function WaalaxyExport({ count }: { count: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkedinIcon className="w-5 h-5" />
          Exporter pour Waalaxy
        </CardTitle>
        <CardDescription>
          Waalaxy importe des personnes, pas des entreprises : chaque ligne doit contenir l&apos;adresse d&apos;un
          profil LinkedIn. Ce fichier contient les contacts de vos entreprises en cours dont le profil est
          renseigné (bouton « Chercher sur LinkedIn » sur chaque fiche entreprise), avec leur e-mail s&apos;il est
          connu. Les contacts opposés à la prospection n&apos;y figurent jamais. Pour n&apos;exporter qu&apos;une partie
          d&apos;entre eux, regroupez-les dans une liste (page Personnes) et exportez la liste depuis là.
          Pour le retour : exportez votre liste depuis Waalaxy (CSV) et importez-la plus haut. Les invitations,
          messages et réponses sont notés dans l&apos;historique de chaque personne, sans doublon.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {count > 0 ? (
          <Button asChild variant="outline">
            <a href="/api/export/waalaxy" download>
              <Download className="w-4 h-4 mr-2" />
              Exporter {count} contact{count > 1 ? 's' : ''} pour Waalaxy
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun contact n&apos;a encore de profil LinkedIn. Ouvrez une fiche entreprise, cliquez sur « Chercher sur
            LinkedIn » à côté d&apos;un contact, puis « Ajouter son profil » pour coller l&apos;adresse trouvée.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
