'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistance } from 'date-fns'
import { fr } from 'date-fns/locale'
import { AlertTriangle, Loader2, Pause, Play, Power, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { resumeLinkedinAutomation, setLinkedinAutomation } from '@/lib/actions/linkedin-sequences'
import { sendToExtension, type ExtensionStatus } from '@/lib/extension'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { formatDate } from '@/lib/utils/dates'
import { useToast } from '@/lib/hooks/use-toast'
import type { LinkedinAutomation } from '@/lib/queries/linkedin'
import { confirmAction } from '@/components/ui/confirm-dialog'
import { LinkedinRiskDialog } from './linkedin-risk-dialog'

// L'extension passe chaque minute quand Chrome est ouvert : au-delà, elle est sans doute fermée
const ACTIVE_WITHIN_MS = 15 * 60 * 1000

/**
 * Pause posée par l'extension parce que LinkedIn a demandé une vérification ou limité le compte
 * (pas une simple déconnexion, ni un changement de LinkedIn qui attend une mise à jour)
 */
export function isLinkedinRestriction(reason: string | null): boolean {
  return !!reason && /vérification|limit/i.test(reason)
}

const RESTRICTION_ADVICE =
  'LinkedIn a demandé une vérification ou limité votre compte. Réglez d’abord la situation sur LinkedIn, puis attendez quelques jours avant de réactiver. Réactiver tout de suite augmente le risque de restriction plus longue.'

/**
 * Envoi automatique par l'extension : l'interrupteur, l'état (actif, en pause et pourquoi),
 * et le dernier passage de l'extension
 */
export function AutomationPanel({
  automation,
  now,
  actionsPerDay,
}: {
  automation: LinkedinAutomation
  now: number
  // Plafond d'actions par jour de l'extension (invitations et messages), rappelé avant d'activer
  actionsPerDay: number
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [busy, setBusy] = useState(false)
  const [riskOpen, setRiskOpen] = useState(false)
  // Version de l'extension sans envoi automatique (Chrome Web Store, pour l'instant) : pas d'interrupteur
  const [storeVersion, setStoreVersion] = useState(false)

  useEffect(() => {
    let cancelled = false
    sendToExtension<ExtensionStatus>({ type: 'ping' }).then((status) => {
      if (!cancelled) setStoreVersion(status?.autoSend === false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, success: string): Promise<boolean> => {
    setBusy(true)
    try {
      const result = await action()
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Action impossible', description: result.error })
        return false
      }
      toast({ title: success })
      router.refresh()
      return true
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible', description: CONNECTION_ERROR })
      return false
    } finally {
      setBusy(false)
    }
  }

  // Case cochée dans la fenêtre d'avertissement : la date d'acceptation est enregistrée
  const activate = async () => {
    if (await run(() => setLinkedinAutomation(true, true), 'Envoi automatique activé')) setRiskOpen(false)
  }

  const pause = () => run(() => setLinkedinAutomation(false), 'Envoi automatique mis en pause')

  // Après une vérification ou une limite de LinkedIn, reprendre tout de suite est risqué : on le redit
  const resume = async () => {
    if (
      isLinkedinRestriction(automation.pausedReason) &&
      !(await confirmAction({
        title: 'Reprendre l’envoi automatique maintenant ?',
        description:
          'LinkedIn vient de demander une vérification ou de limiter votre compte. Réactiver tout de suite augmente le risque de restriction plus longue : mieux vaut attendre quelques jours.',
        confirmLabel: 'Reprendre quand même',
      }))
    ) {
      return
    }
    run(resumeLinkedinAutomation, 'Envoi automatique repris')
  }

  const seenRecently = automation.lastSeenAt !== null && now - new Date(automation.lastSeenAt).getTime() < ACTIVE_WITHIN_MS
  const paused = automation.enabled && automation.pausedReason !== null
  const restricted = paused && isLinkedinRestriction(automation.pausedReason)

  const extensionLine = seenRecently
    ? 'Extension active'
    : automation.lastSeenAt
      ? `Extension pas vue depuis ${formatDistance(new Date(automation.lastSeenAt), new Date(now), { locale: fr })} : Chrome est-il ouvert ?`
      : 'L\'extension ne s\'est pas encore manifestée'

  if (storeVersion && !automation.enabled) {
    return (
      <div className="rounded-lg border bg-card p-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-semibold">Envoi automatique</span>
          <Badge variant="secondary">Bientôt disponible</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-3xl">
          Votre extension ajoute vos prospects et repère les posts. L’envoi automatique des invitations arrive dans une
          prochaine version : en attendant, tout se fait en un clic.
        </p>
      </div>
    )
  }

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
            <Button size="sm" variant={restricted ? 'outline' : 'default'} onClick={resume} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Reprendre
            </Button>
          )}
          {/* Actif : le bouton « Mettre en pause » est dans le rappel ci-dessous */}
          {paused && (
            <Button variant="outline" size="sm" onClick={pause} disabled={busy}>
              <Pause className="w-4 h-4 mr-2" />
              Désactiver
            </Button>
          )}
          {!automation.enabled && (
            <Button size="sm" onClick={() => setRiskOpen(true)} disabled={busy}>
              <Power className="w-4 h-4 mr-2" />
              Activer
            </Button>
          )}
        </div>
      </div>

      {/* Rappel permanent tant que l'envoi automatique est actif */}
      {automation.enabled && !paused && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Envoi automatique actif.</strong> LinkedIn peut restreindre les comptes qui utilisent ce type
              d’outil : gardez des volumes bas.
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={pause} disabled={busy} className="shrink-0 bg-background">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Pause className="w-4 h-4 mr-2" />}
            Mettre en pause
          </Button>
        </div>
      )}

      {restricted && (
        <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p>
            <strong>Envoi automatique mis en pause.</strong> {RESTRICTION_ADVICE}
          </p>
          <p className="text-xs">
            Message de LinkedIn : {automation.pausedReason}
            {automation.pausedUntil &&
              ` L’extension réessaiera d’elle-même le ${formatDate(automation.pausedUntil, "d MMMM 'à' HH'h'mm")} : désactivez l’envoi automatique si vous préférez attendre plus longtemps.`}
          </p>
        </div>
      )}

      {paused && !restricted && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {automation.pausedReason}
          {automation.pausedUntil &&
            ` Reprise automatique le ${formatDate(automation.pausedUntil, "d MMMM 'à' HH'h'mm")}.`}{' '}
          En attendant, tout reste faisable en un clic.
        </p>
      )}

      {/* On ne promet l'envoi automatique que si l'extension s'est manifestée récemment */}
      <p className="text-sm text-muted-foreground max-w-3xl">
        {seenRecently
          ? 'Invitations et premiers messages partent du lundi au vendredi, de 9 h à 18 h, quand Chrome est ouvert. Les relances se font en un clic.'
          : 'L’envoi automatique demande l’extension Chrome de Filonea. Sans elle, tout se fait en un clic.'}
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

      <LinkedinRiskDialog
        open={riskOpen}
        onOpenChange={setRiskOpen}
        actionsPerDay={actionsPerDay}
        busy={busy}
        onConfirm={activate}
      />
    </div>
  )
}
