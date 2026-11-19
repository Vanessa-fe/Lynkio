import Link from 'next/link'
import { Lock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AI_QUOTA_LABELS } from '@/lib/ai-quota'
import type { AiAvailability } from '@/lib/queries/ai-access'

/** Paramètres > Vos clés : IA incluse dans Pro (et ce qu'il reste ce mois-ci), ou cadenas en Essentiel */
export function AiIncludedCard({ ai }: { ai: AiAvailability }) {
  if (ai.mode === 'own') return null

  if (ai.mode === 'none') {
    if (ai.plan !== 'essentiel') return null
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            L’IA est incluse dans l’offre Pro
          </CardTitle>
          <CardDescription>
            Avec l’offre Essentiel, Sophie utilise votre propre IA : ajoutez sa clé ci-dessous. En Pro, vous n’avez rien à
            configurer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/billing">Passer en Pro</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          IA incluse dans votre offre Pro
        </CardTitle>
        <CardDescription>
          Sophie utilise l’IA de Filonea : vous n’avez rien à configurer.
          {ai.trial && ' Pendant l’essai, vous disposez de la moitié des quantités de l’offre Pro.'} Vous préférez votre
          propre IA ? Ajoutez sa clé ci-dessous : elle sera utilisée à la place, sans limite mensuelle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-sm font-medium">Ce mois-ci</p>
        <ul className="space-y-3">
          {ai.usage.map(({ action, used, quota }) => {
            const left = Math.max(quota - used, 0)
            return (
              <li key={action} className="text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span>{AI_QUOTA_LABELS[action]}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {left} restant{left > 1 ? 's' : ''} sur {quota}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((used / quota) * 100, 100)}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">Les compteurs repartent à zéro le 1er de chaque mois.</p>
      </CardContent>
    </Card>
  )
}
