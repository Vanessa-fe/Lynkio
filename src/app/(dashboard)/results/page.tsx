import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Recommendations } from '@/components/results/recommendations'
import { FunnelFilters } from '@/components/results/funnel-filters'
import { getFunnelData } from '@/lib/queries/funnel'
import { SMALL_SAMPLE } from '@/lib/funnel'
import { formatDate } from '@/lib/utils/dates'

type Search = { period?: string; strategy?: string; source?: string; sector?: string }

export default async function ResultsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const data = await getFunnelData(await searchParams)
  if (!data) redirect('/login')
  const { result, filters, since, options } = data
  const found = result.steps[0]!.count
  const widest = Math.max(found, 1)

  return (
    <div className="space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Tableau de bord
        </Link>
      </Button>

      <div>
        <h1 className="text-3xl font-bold">Vos résultats</h1>
        <p className="text-muted-foreground mt-2">
          Ce que deviennent les entreprises ajoutées {since ? `depuis le ${formatDate(since, 'd MMMM yyyy')}` : 'depuis le début'}
          , étape par étape.
        </p>
      </div>

      <FunnelFilters filters={filters} options={options} />

      <Card>
        <CardHeader>
          <CardTitle>Entonnoir</CardTitle>
          <CardDescription>
            Chaque entreprise compte à l’étape la plus avancée qu’elle a atteinte, et à toutes celles d’avant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {found === 0 ? (
            <p className="text-sm text-muted-foreground">
              Pas encore de donnée pour ces filtres : aucune entreprise ajoutée sur la période.
            </p>
          ) : (
            <ol className="space-y-3">
              {result.steps.map((step, index) => {
                const rate = index > 0 ? result.rates[index - 1]! : null
                return (
                  <li key={step.key} className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
                      <span>
                        <span className="font-medium">{step.label}</span>{' '}
                        <span className="text-muted-foreground">· {step.hint}</span>
                      </span>
                      <span className="tabular-nums">
                        <span className="font-semibold">{step.count}</span>
                        {rate && (
                          <span className="text-muted-foreground">
                            {' '}
                            ·{' '}
                            {rate.rate === null
                              ? '— (aucune à l’étape d’avant)'
                              : `${rate.rate} % (${rate.numerator} sur ${rate.denominator})`}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((step.count / widest) * 100)}%` }} />
                    </div>
                    {rate?.small && (
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        Petit échantillon ({rate.denominator} entreprise{rate.denominator > 1 ? 's' : ''}) : ce taux peut beaucoup varier, il ne permet pas
                        encore de conclure.
                      </p>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Recommendations suggestions={data.suggestions} scope={[data.userId, filters.period, filters.source, filters.sector, filters.strategy].join('/')} />

      {found > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Mises « Hors cible »</p>
              <p className="text-2xl font-semibold tabular-nums">{result.excluded}</p>
              <p className="text-xs text-muted-foreground">sur {found} ajoutées</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Perdues</p>
              <p className="text-2xl font-semibold tabular-nums">{result.lost}</p>
              <p className="text-xs text-muted-foreground">sur {found} ajoutées</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
            Comment c’est calculé
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            On part des entreprises ajoutées pendant la période (et correspondant aux filtres). Une étape est atteinte
            d’après l’étape de la fiche, son historique d’étapes (suivi depuis sa mise en place) et vos échanges
            notés : un envoi = contactée, une réponse reçue = réponse, un rendez-vous noté = rendez-vous.
          </p>
          <p>
            Chaque taux se lit « tant sur tant » par rapport à l’étape d’avant. « — » veut dire qu’il n’y a pas encore de
            donnée, ce qui n’est pas la même chose que 0 %. Sous {SMALL_SAMPLE} entreprises, un taux est signalé comme
            petit échantillon.
          </p>
          <p>Ces chiffres décrivent ce qui s’est passé ; ils ne disent pas pourquoi.</p>
        </CardContent>
      </Card>
    </div>
  )
}
