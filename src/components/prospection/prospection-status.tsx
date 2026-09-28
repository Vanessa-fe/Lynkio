'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Loader2, Play, Radar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { launchProspection } from '@/lib/actions/prospection'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { PipelineRun, ProspectionSettings } from '@/types'
import { formatDate } from '@/lib/utils/dates'

// Rafraîchissement de la page tant qu'un passage est en cours
const POLL_INTERVAL_MS = 3000

interface ProspectionStatusProps {
  settings: ProspectionSettings | null
  runningRun: PipelineRun | null
}

export function ProspectionStatus({ settings, runningRun }: ProspectionStatusProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLaunching, setIsLaunching] = useState(false)

  const isRunning = !!runningRun
  const hasDepartments = (settings?.departments.length ?? 0) > 0

  useEffect(() => {
    if (!isRunning) return
    const timer = setInterval(() => router.refresh(), POLL_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [isRunning, router])

  const handleLaunch = async () => {
    setIsLaunching(true)
    let result: Awaited<ReturnType<typeof launchProspection>>
    try {
      result = await launchProspection()
    } catch {
      toast({ variant: 'destructive', title: 'Lancement impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setIsLaunching(false)
    }

    if (result.success) {
      toast({ title: 'Sophie est partie chercher', description: 'Les résultats arrivent dans quelques instants.' })
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Lancement impossible',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  return (
    <Card>
      <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="rounded-full bg-primary/10 p-3 text-primary shrink-0">
            {isRunning ? <Loader2 className="w-6 h-6 animate-spin" /> : <Radar className="w-6 h-6" />}
          </div>
          <div className="space-y-1" aria-live="polite">
            {isRunning ? (
              <>
                <p className="font-semibold">Sophie cherche des entreprises…</p>
                <p className="text-sm text-muted-foreground">
                  Commencé à {formatDate(new Date(runningRun.started_at), 'HH:mm')}. La page se met
                  à jour toute seule.
                </p>
              </>
            ) : settings?.is_active && settings.next_run_at ? (
              <>
                <p className="font-semibold">Prospection automatique activée</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4" />
                  Prochaine prospection le{' '}
                  {formatDate(new Date(settings.next_run_at), "EEEE d MMMM 'à' H'h'")}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold">Prospection automatique désactivée</p>
                <p className="text-sm text-muted-foreground">
                  {hasDepartments
                    ? 'Lancez une recherche maintenant, ou activez le planning ci-dessous.'
                    : 'Choisissez au moins un département ci-dessous, puis lancez une première recherche.'}
                </p>
              </>
            )}
          </div>
        </div>

        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={isRunning || isLaunching || !hasDepartments}
          className="shrink-0"
        >
          {isLaunching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Lancer maintenant
        </Button>
      </CardContent>
    </Card>
  )
}
