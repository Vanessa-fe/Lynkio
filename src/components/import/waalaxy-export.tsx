import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'

/**
 * Export des contacts pour un outil d'automatisation LinkedIn (profils LinkedIn uniquement).
 * Le format est celui qu'attend Waalaxy, sans le nommer dans l'interface.
 */
export function WaalaxyExport({ count }: { count: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkedinIcon className="w-5 h-5" />
          Export CSV pour automatisation LinkedIn
        </CardTitle>
        <CardDescription>Vos contacts avec un profil LinkedIn, pour votre outil d&apos;automatisation. Réimportez son CSV ici au retour.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {count > 0 ? (
          <Button asChild variant="outline">
            <a href="/api/export/waalaxy" download>
              <Download className="w-4 h-4 mr-2" />
              Exporter {count} contact{count > 1 ? 's' : ''} en CSV
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucun contact n&apos;a encore de profil LinkedIn.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
