'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Loader2, Pause, Play, Power, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { resumeLinkedinAutomation, setLinkedinAutomation } from '@/lib/actions/linkedin-sequences'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { formatDate } from '@/lib/utils/dates'
import { useToast } from '@/lib/hooks/use-toast'
import type { LinkedinAutomation } from '@/lib/queries/linkedin'

// L'extension passe chaque minute quand Chrome est ouvert : au-delà, elle est sans doute fermée
const ACTIVE_WITHIN_MS = 15 * 60 * 1000

/**
 * Envoi automatique par l'extension : l'interrupteur, l'état (actif, en pause et pourquoi),
 * et le dernier passage de l'extension
 */
export function AutomationPanel({ automation, now }: { automation: LinkedinAutomation; now: number }) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, success: string) => {
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

  const seenRecently = automation.lastSeenAt !== null && now - new Date(automation.lastSeenAt).getTime() < ACTIVE_WITHIN_MS
  const paused = automation.enabled && automation.pausedReason !== null

  const extensionLine = seenRecently
    ? 'Extension active'
    : automation.lastSeenAt
      ? `Extension pas vue depuis ${formatDistance(new Date(automation.lastSeenAt), new Date(now), { locale: fr })} : Chrome est-il ouvert ?`
      : 'L\'extension ne s\'est pas encore manifestée'

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-semibold">Envoi automatique</span>
          {!automation.enabled && <Badge variant="secondary">Désactivé</Badge>}
          {paused && <Badge className="bg-amber-500 hover:bg-amber-500">En pause</Badge>}
          {automation.enabled && !paused && <Badge className="bg-emerald-600 hover:bg-emerald-600">Actif</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          {paused && (
            <Button size="sm" onClick={() => run(resumeLinkedinAutomation, 'Envoi automatique repris')} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Reprendre
            </Button>
          )}
          {automation.enabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => run(() => setLinkedinAutomation(false), 'Envoi automatique désactivé')}
              disabled={busy}
            >
              <Pause className="w-4 h-4 mr-2" />
              Désactiver
            </Button>
          ) : (
            <Button size="sm" onClick={() => run(() => setLinkedinAutomation(true), 'Envoi automatique activé')} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Power className="w-4 h-4 mr-2" />}
              Activer
            </Button>
          )}
        </div>
      </div>

      {paused && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {automation.pausedReason}
          {automation.pausedUntil &&
            ` Reprise automatique le ${formatDate(automation.pausedUntil, "d MMMM 'à' HH'h'mm")}.`}{' '}
          En attendant, tout reste faisable en un clic.
        </p>
      )}

      <p className="text-sm text-muted-foreground max-w-3xl">
        L&apos;extension envoie les invitations, repère celles qui sont acceptées et envoie le premier message, du lundi au
        vendredi de 9 h à 18 h, quand Chrome est ouvert. Les relances restent en un clic pour l&apos;instant.
      </p>

      <p className="text-xs text-muted-foreground">
        {extensionLine}
        {automation.lastActionAt &&
          ` · dernier envoi automatique ${formatDistance(new Date(automation.lastActionAt), new Date(now), { addSuffix: true, locale: fr })}`}
        {!seenRecently && (
          <>
            {' · '}
            <Link href="/settings/extension" className="underline hover:text-foreground">
              Installer ou connecter l&apos;extension
            </Link>
          </>
        )}
      </p>
    </div>
  )
}
