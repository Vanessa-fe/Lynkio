import Link from 'next/link'
import { Gauge } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SUGGESTED_GOALS } from '@/lib/validations/offer'
import type { GoalProgress } from '@/lib/queries/offer'

const euros = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount)

function GoalGauge({ label, done, goal, format = String }: { label: string; done: number; goal: number; format?: (n: number) => string }) {
  const ratio = goal > 0 ? Math.min(done / goal, 1) : 0
  const reached = goal > 0 && done >= goal
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {format(done)} / {format(goal)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={done}
      >
        <div
          className={reached ? 'h-full rounded-full bg-green-500' : 'h-full rounded-full bg-primary'}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Baromètre : où l'on en est par rapport à ses objectifs (prises de contact de la semaine, clients
 * et chiffre d'affaires signés du mois), d'après les échanges notés et les étapes « gagnée ».
 */
export function GoalsBarometer({ progress }: { progress: GoalProgress }) {
  const { goals } = progress
  const hasGoals = goals.contactsPerWeek || goals.clientsPerMonth || goals.revenuePerMonth

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" aria-hidden />
          Vos objectifs
        </CardTitle>
        <CardDescription>
          {hasGoals
            ? 'D’après vos échanges notés et vos fiches gagnées.'
            : 'Fixez-vous un rythme : Sophie vous montrera où vous en êtes.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasGoals ? (
          <>
            {!!goals.contactsPerWeek && (
              <GoalGauge label="Prises de contact cette semaine" done={progress.contactsThisWeek} goal={goals.contactsPerWeek} />
            )}
            {!!goals.clientsPerMonth && (
              <GoalGauge label="Nouveaux clients ce mois-ci" done={progress.clientsThisMonth} goal={goals.clientsPerMonth} />
            )}
            {!!goals.revenuePerMonth && (
              <GoalGauge
                label="Chiffre d’affaires signé ce mois-ci"
                done={progress.revenueThisMonth}
                goal={goals.revenuePerMonth}
                format={euros}
              />
            )}
            <Link href="/settings/offer" className="text-sm text-primary underline-offset-2 hover:underline">
              Modifier mes objectifs
            </Link>
          </>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Par exemple : {SUGGESTED_GOALS.contactsPerWeek} prises de contact par semaine et{' '}
              {SUGGESTED_GOALS.clientsPerMonth} nouveaux clients par mois. À adapter selon vos envies.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/offer">Choisir mes objectifs</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
