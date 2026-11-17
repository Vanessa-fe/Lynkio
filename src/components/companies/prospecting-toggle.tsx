'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { startProspecting, stopProspecting } from '@/lib/actions/companies'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { formatDate } from '@/lib/utils/dates'
import { cn } from '@/lib/utils'

/**
 * Découverte ou en démarche (lot 1.8b) : l'utilisateur décide de commencer à prospecter une entreprise,
 * ou la retire du suivi. Une entreprise mise « Hors cible » sans démarche reste une découverte écartée.
 */
export function ProspectingToggle({
  companyId,
  engagedAt,
  excluded,
  compact = false,
}: {
  companyId: string
  engagedAt: string | null
  // Étape « Hors cible » : pas de bouton pour commencer (on change d'abord d'étape)
  excluded: boolean
  // Version ligne de tableau : bouton seul, plus petit
  compact?: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => ReturnType<typeof startProspecting>, success: string) => {
    setBusy(true)
    try {
      const result = await action()
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Action impossible', description: result.error })
        return
      }
      toast({ title: success })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible', description: CONNECTION_ERROR })
    } finally {
      setBusy(false)
    }
  }

  if (engagedAt) {
    if (compact) return null
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">En démarche depuis le {formatDate(new Date(engagedAt), 'd MMMM yyyy')}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={busy}
          onClick={() => {
            if (!confirm('Retirer cette entreprise du suivi commercial ? Ses échanges et son historique sont gardés.')) return
            run(() => stopProspecting(companyId), 'Entreprise retirée du suivi')
          }}
        >
          Retirer du suivi
        </Button>
      </div>
    )
  }

  if (excluded) return compact ? null : <Badge variant="outline">Découverte écartée</Badge>

  return (
    <div className={cn('flex flex-wrap items-center gap-2', compact && 'justify-start')}>
      {!compact && <Badge variant="outline">Découverte</Badge>}
      <Button
        type="button"
        size="sm"
        variant={compact ? 'outline' : 'default'}
        disabled={busy}
        onClick={() => run(() => startProspecting(companyId), 'C’est parti : l’entreprise est dans votre suivi commercial')}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
        {compact ? 'Prospecter' : 'Commencer à prospecter'}
      </Button>
    </div>
  )
}
