'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Info, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getRunOutcome } from '@/lib/actions/prospection'
import { describeRunOutcome, type RunOutcome } from '@/lib/run-outcome'
import { stopWatching, WATCH_EVENT, watchedRun } from './run-watch'

// Vérification de l'état de la recherche suivie
const POLL_INTERVAL_MS = 3000
// Au-delà, le serveur considère le passage comme interrompu (STALE_RUN_MINUTES) : on arrête d'attendre
const GIVE_UP_AFTER_MS = 16 * 60_000

const ICONS = {
  success: <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />,
  partial: <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />,
  empty: <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />,
  failed: <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />,
  running: <Info className="h-5 w-5" aria-hidden="true" />,
}

/**
 * Fenêtre de fin d'une recherche lancée à la main (lot 1.3) : nombre réel d'entreprises ajoutées et
 * déjà connues, résultat partiel, aucun résultat, échec. Montée dans la mise en page : elle s'ouvre
 * quelle que soit la page où se trouve l'utilisateur à la fin de la recherche.
 */
export function RunCompletionDialog() {
  const router = useRouter()
  const pathname = usePathname()
  const [runId, setRunId] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<(RunOutcome & { runId: string }) | null>(null)

  // Recherche à suivre : au chargement, puis à chaque nouveau lancement
  useEffect(() => {
    const read = () => setRunId(watchedRun())
    read()
    window.addEventListener(WATCH_EVENT, read)
    return () => window.removeEventListener(WATCH_EVENT, read)
  }, [])

  const check = useCallback(
    async (id: string) => {
      const run = await getRunOutcome(id).catch(() => undefined)
      // Coupure réseau passagère : on réessaiera au prochain tour
      if (run === undefined) return false
      if (run === null) {
        stopWatching()
        setRunId(null)
        return true
      }
      const result = describeRunOutcome(run)
      if (result.kind === 'running') return false
      stopWatching()
      setRunId(null)
      setOutcome({ ...result, runId: id })
      router.refresh()
      return true
    },
    [router]
  )

  useEffect(() => {
    if (!runId) return
    const startedAt = Date.now()
    let stopped = false
    const tick = async () => {
      if (stopped) return
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        stopWatching()
        setRunId(null)
        return
      }
      const done = await check(runId)
      if (!done && !stopped) timer = setTimeout(tick, POLL_INTERVAL_MS)
    }
    let timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [runId, check])

  const close = () => setOutcome(null)
  const companiesHref = outcome ? `/companies?passage=${outcome.runId}` : '/companies'

  return (
    <Dialog open={outcome !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        {outcome && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {ICONS[outcome.kind]}
                {outcome.title}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2 pt-1 text-sm text-foreground">
                  {outcome.lines.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              {outcome.created > 0 ? (
                <>
                  <Button variant="outline" onClick={close}>
                    Fermer
                  </Button>
                  <Button asChild onClick={close}>
                    <Link href={companiesHref}>Voir les entreprises</Link>
                  </Button>
                </>
              ) : outcome.kind === 'empty' && !pathname.startsWith('/prospection') ? (
                <>
                  <Button variant="outline" onClick={close}>
                    Fermer
                  </Button>
                  <Button asChild onClick={close}>
                    <Link href="/prospection">Modifier mes recherches</Link>
                  </Button>
                </>
              ) : (
                <Button onClick={close}>Fermer</Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
