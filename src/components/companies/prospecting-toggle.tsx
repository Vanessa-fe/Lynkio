'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { stopProspecting } from '@/lib/actions/companies'
import { confirmAction } from '@/components/ui/confirm-dialog'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { formatDate } from '@/lib/utils/dates'

/**
 * Découverte ou en démarche (lot 1.8b), sur la fiche : un badge, et « Retirer du suivi » pour une
 * entreprise en démarche. On entre dans le suivi en choisissant une étape (DiscoveryStageSelect).
 * Une entreprise mise « Hors cible » sans démarche reste une découverte écartée.
 */
export function ProspectingToggle({
  companyId,
  engagedAt,
  excluded,
}: {
  companyId: string
  engagedAt: string | null
  // Étape « Hors cible » sans démarche : découverte écartée
  excluded: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => ReturnType<typeof stopProspecting>, success: string) => {
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
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">En démarche depuis le {formatDate(new Date(engagedAt), 'd MMMM yyyy')}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          disabled={busy}
          onClick={async () => {
            const confirmed = await confirmAction({
              title: 'Retirer cette entreprise du suivi commercial ?',
              description: 'Elle redevient une découverte. Ses échanges et son historique sont gardés.',
              confirmLabel: 'Retirer du suivi',
            })
            if (!confirmed) return
            run(() => stopProspecting(companyId), 'Entreprise retirée du suivi')
          }}
        >
          Retirer du suivi
        </Button>
      </div>
    )
  }

  return <Badge variant="outline">{excluded ? 'Découverte écartée' : 'Découverte'}</Badge>
}
