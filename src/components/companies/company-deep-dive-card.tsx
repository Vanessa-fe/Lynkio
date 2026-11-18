'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/dates'
import { ProvenanceBadge } from './provenance-badge'
import { DEEP_ANALYSIS_CACHE_DAYS, type DeepAnalysisFinding, type DeepAnalysisView } from '@/lib/deep-analysis'

const POLL_MS = 4000
// Au-delà, on arrête d'attendre (la fonction marque elle-même une analyse bloquée comme échouée)
const MAX_WAIT_MS = 5 * 60_000

const CONFIDENCE_LABELS = { high: 'confiance élevée', medium: 'confiance moyenne', low: 'confiance faible' } as const

interface CompanyDeepDiveCardProps {
  companyId: string
  analysis: DeepAnalysisView | null
  hasAiKey: boolean
}

/**
 * « Approfondir avec Sophie » : recherche sur Internet, par l'IA de l'utilisateur, des annonces publiques
 * de cette entreprise liées à ses prestations. Lancée seulement ici, à la demande.
 */
export function CompanyDeepDiveCard({ companyId, analysis, hasAiKey }: CompanyDeepDiveCardProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [waiting, setWaiting] = useState(analysis?.status === 'running')

  // Analyse en cours : on suit son état jusqu'à la fin, puis la fiche est rechargée
  useEffect(() => {
    if (!waiting) return
    const supabase = createClient()
    const started = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - started > MAX_WAIT_MS) {
        clearInterval(timer)
        setWaiting(false)
        setError('L’analyse prend plus de temps que prévu : rechargez la page dans un instant.')
        return
      }
      const { data } = await supabase
        .from('company_deep_analyses')
        .select('status')
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data && data.status !== 'running') {
        clearInterval(timer)
        setWaiting(false)
        router.refresh()
      }
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [waiting, companyId, router])

  const start = async (force: boolean) => {
    setError(null)
    setIsStarting(true)
    try {
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke<{ status: string; cached?: boolean }>(
        'company-deep-dive',
        { body: { companyId, force } }
      )
      if (invokeError || !data) {
        const detail =
          invokeError instanceof FunctionsHttpError
            ? ((await invokeError.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setError(detail ?? CONNECTION_ERROR)
        return
      }
      if (data.status === 'running') setWaiting(true)
      else router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsStarting(false)
    }
  }

  const retained = analysis?.status === 'done' ? analysis.findings.filter((finding) => finding.retained) : []
  const rejected = analysis?.status === 'done' ? analysis.findings.filter((finding) => !finding.retained) : []
  const isFresh = analysis?.isFresh ?? false

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" aria-hidden />
          Approfondir avec Sophie
        </CardTitle>
        <CardDescription>Annonces publiques liées à vos prestations. Seuls les faits datés et sourcés deviennent des signaux.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {waiting ? (
          <p className="flex items-center gap-2 text-muted-foreground" role="status">Environ une minute. Vous pouvez quitter la page.</p>
        ) : analysis?.status === 'done' ? (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Analyse du {formatDate(analysis.startedAt, 'd MMMM yyyy')}
              {/* Résumé de l'IA seulement si un résultat est retenu : sinon il pourrait contredire le constat */}
              {retained.length > 0 && analysis.summary && ` : ${analysis.summary}`}
            </p>
            {analysis.identity && !analysis.identity.confirmed && (
              <p className="rounded-lg bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Identité non confirmée : {analysis.identity.explanation} Aucun signal n’a été ajouté.
              </p>
            )}
            {retained.length > 0 ? (
              <ul className="space-y-3">
                {retained.map((finding) => (
                  <FindingItem key={`${finding.event}-${finding.title}`} finding={finding} />
                ))}
              </ul>
            ) : (
              <p className="font-medium">Aucun signal supplémentaire confirmé pour cette entreprise.</p>
            )}
            {rejected.length > 0 && (
              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer font-medium">Non retenus ({rejected.length})</summary>
                <ul className="mt-2 space-y-2 text-muted-foreground">
                  {rejected.map((finding) => (
                    <li key={`${finding.event}-${finding.title}`}>
                      <span className="text-foreground">{finding.title}</span> · {finding.rejection}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ) : analysis?.status === 'failed' ? (
          <p className="text-destructive">{analysis.error ?? 'L’analyse précédente n’a pas abouti.'}</p>
        ) : null}

        {error && (
          <p className="text-destructive" role="alert">
            {error}
          </p>
        )}

        {!waiting &&
          (hasAiKey ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant={analysis?.status === 'done' ? 'outline' : 'default'}
                onClick={() => start(isFresh)}
                disabled={isStarting}
              >
                {isStarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                {analysis?.status === 'done' ? 'Relancer l’analyse' : 'Approfondir avec Sophie'}
              </Button>
              <span className="text-xs text-muted-foreground">
                Une recherche sur Internet avec votre IA, payée par votre clé
                {isFresh && ` ; l’analyse actuelle reste valable ${DEEP_ANALYSIS_CACHE_DAYS} jours`}.
              </span>
            </div>
          ) : (
            <Button asChild variant="outline">
              <Link href="/settings/keys">
                <KeyRound className="mr-2 h-4 w-4" />
                Ajouter ma clé d’IA pour approfondir
              </Link>
            </Button>
          ))}
      </CardContent>
    </Card>
  )
}

function FindingItem({ finding }: { finding: DeepAnalysisFinding }) {
  return (
    <li className="space-y-1 rounded-lg bg-muted p-3">
      <div className="flex flex-wrap items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" aria-hidden />
        <span className="font-medium">{finding.eventLabel}</span>
        <ProvenanceBadge kind="ai" />
        <span className="text-xs text-muted-foreground">
          Signal ajouté · {CONFIDENCE_LABELS[finding.confidence]}
        </span>
      </div>
      <p>{finding.title}</p>
      {finding.summary && <p className="text-muted-foreground">{finding.summary}</p>}
      {finding.relevance && (
        <p className="text-muted-foreground">
          <ProvenanceBadge kind="hypothesis" className="mr-1.5" />
          <span className="font-medium">Piste, non confirmée : </span>
          {finding.relevance}
          {finding.service && ` (${finding.service})`}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {finding.date && `Annoncé le ${formatDate(finding.date, 'd MMMM yyyy')}`}
        {finding.sourceUrl && (
          <>
            {' · '}
            <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 hover:underline">
              Voir la source
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          </>
        )}
      </p>
    </li>
  )
}
