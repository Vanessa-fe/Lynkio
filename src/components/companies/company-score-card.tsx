import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { CompanyQualification } from '@/types'
import { CompanyScore } from './company-stage-select'
import { formatDate } from '@/lib/utils/dates'

// Une ligne du détail écrit par compute_company_score (colonne reasons).
// v2 (rules-v2, compute_company_score_v2) ajoute le groupe, le maximum et la nature de la ligne.
type ScoreReason = {
  code: string
  label: string
  points: number
  group?: 'fit' | 'signals' | 'freshness' | 'reach' | 'exclusion'
  max?: number
  kind?: 'positive' | 'negative' | 'unavailable' | 'summary'
}

const GROUPS = [
  { key: 'fit', label: 'Adéquation à votre recherche', max: 50 },
  { key: 'signals', label: 'Signaux d’achat', max: 35 },
  { key: 'freshness', label: 'Fraîcheur', max: 10 },
  { key: 'reach', label: 'Joignabilité', max: 5 },
] as const

const KIND_MARKS: Record<string, { mark: string; className: string; sr: string }> = {
  positive: { mark: '✓', className: 'text-green-700 dark:text-green-400', sr: 'Critère rempli' },
  negative: { mark: '✗', className: 'text-red-700 dark:text-red-400', sr: 'Critère non rempli' },
  unavailable: { mark: '?', className: 'text-muted-foreground', sr: 'Information indisponible' },
}

function groupPoints(reasons: ScoreReason[], group: (typeof GROUPS)[number]): number {
  const items = reasons.filter((reason) => reason.group === group.key)
  // Adéquation : total déjà ramené aux critères connus (ligne « summary »)
  const summary = items.find((reason) => reason.kind === 'summary')
  if (summary) return summary.points
  return Math.min(
    group.max,
    items.reduce((total, reason) => total + reason.points, 0)
  )
}

/** Détail v2 : quatre groupes, chaque critère rempli, non rempli ou inconnu */
function ScoreV2({ reasons }: { reasons: ScoreReason[] }) {
  return (
    <div className="space-y-4">
      {GROUPS.map((group) => {
        const items = reasons.filter((reason) => reason.group === group.key && reason.kind !== 'summary')
        return (
          <section key={group.key} className="space-y-1.5">
            <h3 className="flex items-baseline justify-between gap-4 text-sm font-medium">
              <span>{group.label}</span>
              <span className="tabular-nums">
                {groupPoints(reasons, group)} / {group.max}
              </span>
            </h3>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">Rien pour l’instant</p>
            ) : (
              <ul className="space-y-1">
                {items.map((reason) => {
                  const mark = KIND_MARKS[reason.kind ?? 'positive'] ?? KIND_MARKS.positive!
                  return (
                    <li key={reason.code} className="flex items-baseline justify-between gap-4 text-sm">
                      <span className={reason.kind === 'positive' ? undefined : 'text-muted-foreground'}>
                        <span className={`mr-2 font-semibold ${mark.className}`} aria-hidden>
                          {mark.mark}
                        </span>
                        <span className="sr-only">{mark.sr} : </span>
                        {reason.label}
                      </span>
                      {reason.kind === 'positive' && (
                        <span className="shrink-0 font-medium tabular-nums">+{reason.points}</span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        )
      })}
      <p className="text-xs text-muted-foreground">
        ? = information que Sophie ne connaît pas : elle ne fait ni monter ni baisser le score. Le score dit à quel point
        la fiche correspond, pas la probabilité de signer.
      </p>
    </div>
  )
}

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
              votre client idéal{qualification.model === 'rules-v2' ? ' et votre recherche' : ''}. Il se met à jour
              tout seul quand la fiche évolue.
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
        ) : reasons.some((reason) => reason.group) ? (
          <ScoreV2 reasons={reasons} />
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
