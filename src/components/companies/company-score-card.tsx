import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CompanyQualification } from '@/types'
import { CompanyScore } from './company-stage-select'
import { formatDate } from '@/lib/utils/dates'

// Une ligne du détail écrit par compute_company_score (colonne reasons)
type ScoreReason = { code: string; label: string; points: number }

function isScoreReason(value: unknown): value is ScoreReason {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as ScoreReason).label === 'string' &&
    typeof (value as ScoreReason).points === 'number'
  )
}

/**
 * Détail du score : chaque critère et les points qu'il rapporte
 */
export function CompanyScoreCard({ qualification }: { qualification: CompanyQualification | null }) {
  if (!qualification) return null

  const reasons = Array.isArray(qualification.reasons) ? qualification.reasons.filter(isScoreReason) : []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Pourquoi ce score</CardTitle>
            <CardDescription>
              Calculé le {formatDate(new Date(qualification.created_at), "d MMMM 'à' HH:mm")} selon
              votre client idéal. Il se met à jour tout seul quand la fiche évolue.
            </CardDescription>
          </div>
          <CompanyScore score={qualification.is_eliminated ? 0 : qualification.score} />
        </div>
      </CardHeader>
      <CardContent>
        {qualification.is_eliminated ? (
          <p className="text-sm text-destructive">Écartée : {qualification.elimination_reason}</p>
        ) : reasons.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun critère ne rapporte de points pour l&apos;instant : pas de signal d&apos;achat, taille et
            contacts inconnus.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {reasons.map((reason) => (
              <li key={reason.code} className="flex items-baseline justify-between gap-4 text-sm">
                <span className={reason.points === 0 ? 'text-muted-foreground' : undefined}>{reason.label}</span>
                <span className="font-medium tabular-nums shrink-0">
                  {reason.points > 0 ? `+${reason.points}` : '0'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
