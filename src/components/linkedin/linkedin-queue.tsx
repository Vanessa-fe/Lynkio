'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Gauge, Sprout, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LinkedinAutomation, LinkedinSequenceRow } from '@/lib/queries/linkedin'
import { lowAcceptanceMessage, type LinkedinCaps } from '@/lib/linkedin-caps'
import { formatDate } from '@/lib/utils/dates'
import { useSessionState } from '@/lib/hooks/use-session-state'
import { AutomationPanel } from './automation-panel'
import { clearLinkedinFocus, LINKEDIN_FOCUS_KEY, parseLinkedinFocus } from './linkedin-focus'
import { ReviewPanel } from './review-panel'
import { notYetDue, pendingSend, SequenceCard } from './sequence-card'

type Tab = {
  key: string
  label: string
  includes: (sequence: LinkedinSequenceRow) => boolean
  empty: string
}

// Relance en attente (à envoyer, ou prévue plus tard)
const hasFollowUp = (sequence: LinkedinSequenceRow) =>
  (sequence.status === 'messaged' || sequence.status === 'followed_up_1') && pendingSend(sequence) !== null

const TABS: Tab[] = [
  { key: 'review', label: 'À relire', includes: (s) => s.status === 'to_review', empty: 'Aucun message à relire.' },
  {
    key: 'invite',
    label: 'À inviter',
    includes: (s) => s.status === 'approved',
    empty: 'Personne à inviter : validez des séquences dans « À relire ».',
  },
  {
    key: 'waiting',
    label: 'Invitations envoyées',
    includes: (s) => s.status === 'invited',
    empty: 'Aucune invitation en attente de réponse.',
  },
  {
    key: 'write',
    label: 'À écrire',
    includes: (s) => s.status === 'connected',
    empty: 'Personne à qui écrire : notez ici les invitations acceptées.',
  },
  {
    key: 'follow',
    label: 'Relances',
    includes: hasFollowUp,
    empty: 'Aucune relance prévue : elles apparaissent ici après l\'envoi du premier message.',
  },
  {
    key: 'done',
    label: 'Suivi',
    includes: (s) => ['messaged', 'followed_up_1', 'followed_up_2', 'replied', 'stopped'].includes(s.status) && !hasFollowUp(s),
    empty: 'Aucune séquence terminée pour l\'instant.',
  },
]

// Ce qu'il y a à faire maintenant dans un onglet (les relances pas encore dues attendent)
function todo(key: string, rows: LinkedinSequenceRow[]): number {
  return key === 'follow' ? rows.filter((sequence) => !notYetDue(sequence)).length : rows.length
}

const DAY_AND_TIME = "d MMMM 'à' HH'h'mm"

function Meter({ label, value, max }: { label: string; value: number; max: number }) {
  const ratio = Math.min(value / max, 1)
  return (
    <div className="space-y-1.5 min-w-[180px] flex-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">
          {value} / {max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${ratio >= 1 ? 'bg-amber-500' : 'bg-primary'}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * File d'envoi LinkedIn, une étape par onglet. Avec l'envoi automatique, l'extension fait les
 * invitations et le premier message ; sinon, on envoie à la main et on note ici ce qui est fait.
 */
export function LinkedinQueue({
  sequences,
  caps,
  automation,
  now,
  backHref = '/people',
  sourceLabel = null,
  fromSelection = false,
}: {
  sequences: LinkedinSequenceRow[]
  // Plafonds du jour et de la semaine, calculés par la base comme pour l'extension
  caps: LinkedinCaps
  automation: LinkedinAutomation
  // Heure du rendu côté serveur : la même pour tout le monde, pas d'écart à l'hydratation
  now: number
  // Page d'où l'on vient (Personnes, une liste, Listes)
  backHref?: string
  // « de la liste « Agences Lyon » » quand on vient d'une liste
  sourceLabel?: string | null
  // Arrivée juste après « Envoyer sur LinkedIn » : on met en avant ces personnes (sinon, toute la file)
  fromSelection?: boolean
}) {
  // Personnes qu'on vient d'envoyer (sélection ou liste) : montrées seules, jusqu'à « Voir toute la file »
  const [focus] = useSessionState(LINKEDIN_FOCUS_KEY, parseLinkedinFocus)
  const focusIds = new Set(focus?.contactIds ?? [])
  const focused = fromSelection && focus ? sequences.filter((sequence) => focusIds.has(sequence.contact.id)) : []
  const showFocus = focused.length > 0
  const visible = showFocus ? focused : sequences

  const byTab = Object.fromEntries(
    TABS.map((tab) => {
      const rows = visible.filter(tab.includes)
      // Relances : celles à envoyer d'abord, puis par date prévue
      if (tab.key === 'follow') {
        rows.sort((a, b) => (a.nextFollowUpDueAt ?? '').localeCompare(b.nextFollowUpDueAt ?? ''))
      }
      return [tab.key, rows]
    })
  ) as Record<string, LinkedinSequenceRow[]>
  // Première étape où il y a quelque chose à faire (« Suivi » en dernier)
  const [tab, setTab] = useState(
    () =>
      // « Suivi » n'est jamais à faire : on n'y arrive que s'il n'y a rien d'autre
      TABS.find((candidate) => candidate.key !== 'done' && todo(candidate.key, byTab[candidate.key]!) > 0)?.key ??
      TABS.find((candidate) => byTab[candidate.key]!.length > 0)?.key ??
      'review'
  )

  // L'onglet ouvert vient de se vider (tout validé, tout invité…) : on passe à l'étape suivante qui a du monde.
  // Même chose quand la mise en avant change (arrivée depuis une sélection, « Voir toute la file »)
  const counts = TABS.map((candidate) => byTab[candidate.key]!.length).join(',')
  const [lastCounts, setLastCounts] = useState(counts)
  if (counts !== lastCounts) {
    setLastCounts(counts)
    const firstTodo = TABS.find((candidate) => candidate.key !== 'done' && todo(candidate.key, byTab[candidate.key]!) > 0)
    if (showFocus && firstTodo && todo(tab, byTab[tab]!) === 0) {
      setTab(firstTodo.key)
    } else if (byTab[tab]!.length === 0) {
      const current = TABS.findIndex((candidate) => candidate.key === tab)
      const ordered = [...TABS.slice(current + 1), ...TABS.slice(0, current)]
      const next = ordered.find((candidate) => byTab[candidate.key]!.length > 0)
      if (next) setTab(next.key)
    }
  }

  // Ce qui bloque les invitations, puis les messages (les deux compteurs sont séparés)
  const notices: string[] = []
  if (caps.invitationsHeldUntil) {
    notices.push(
      `LinkedIn a atteint sa limite hebdomadaire d’invitations : elles reprendront d’elles-mêmes le ${formatDate(caps.invitationsHeldUntil, DAY_AND_TIME)}. Les messages continuent.`
    )
  } else if (caps.invitationsWeek >= caps.invitationsWeekCap) {
    notices.push(
      `${caps.invitationsWeekCap} invitations sur les 7 derniers jours : c’est la limite de LinkedIn. Les invitations reprendront ${caps.weekFreesAt ? `le ${formatDate(caps.weekFreesAt, DAY_AND_TIME)}` : 'dans quelques jours'}, les messages continuent.`
    )
  } else if (caps.invitationsToday >= caps.invitationsTodayCap) {
    notices.push('Plafond d’invitations du jour atteint : la suite demain.')
  }
  if (!caps.canMessage) notices.push('Plafond de messages du jour atteint : la suite demain.')

  if (sequences.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 py-10">
          <p className="text-muted-foreground max-w-xl">
            Aucun envoi en cours. Cochez des personnes (ou ouvrez une liste), puis « Envoyer sur LinkedIn ».
          </p>
          <Button asChild>
            <Link href={backHref}>
              <Users className="w-4 h-4 mr-2" />
              Choisir des personnes
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <AutomationPanel automation={automation} now={now} caps={caps} />

      {showFocus && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="mr-auto">
            {focused.length} personne{focused.length > 1 ? 's' : ''}{' '}
            {sourceLabel ?? (focus?.label === 'list' ? 'de cette liste' : 'de votre sélection')}
          </span>
          <Button size="sm" variant="outline" onClick={clearLinkedinFocus}>
            Voir toute la file ({sequences.length})
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-6 rounded-lg border bg-card p-4">
        <Meter label="Invitations aujourd’hui" value={caps.invitationsToday} max={caps.invitationsTodayCap} />
        <Meter label="Invitations cette semaine (7 jours)" value={caps.invitationsWeek} max={caps.invitationsWeekCap} />
        <Meter label="Messages aujourd’hui" value={caps.messagesToday} max={caps.messagesTodayCap} />
        <div className="space-y-1.5 min-w-[180px] flex-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Taux d’acceptation</span>
            <span className={`font-semibold tabular-nums ${caps.lowAcceptance ? 'text-amber-700 dark:text-amber-400' : ''}`}>
              {caps.acceptanceRate === null ? '—' : `${caps.acceptanceRate} %`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {caps.acceptanceRate === null
              ? 'Mesuré dès 20 invitations envoyées depuis plus de 7 jours'
              : `Sur les ${caps.acceptanceJudged} dernières invitations de plus de 7 jours`}
          </p>
        </div>
        {caps.rampUpUntil && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground basis-full">
            <Sprout className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            Démarrage en douceur jusqu’au {formatDate(caps.rampUpUntil, 'd MMMM')} : Filonea envoie la moitié des
            invitations et des messages prévus, le temps que LinkedIn s’habitue à ce nouveau rythme.
          </p>
        )}
        {caps.lowAcceptance && caps.acceptanceRate !== null && (
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 basis-full">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {lowAcceptanceMessage(caps.acceptanceRate)}
          </p>
        )}
        {notices.map((notice) => (
          <p key={notice} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 basis-full">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {notice}
          </p>
        ))}
        <Link
          href="/settings/extension#rythme"
          className="flex items-center gap-1.5 text-xs text-muted-foreground underline hover:text-foreground basis-full"
        >
          <Gauge className="w-3.5 h-3.5" />
          Régler le rythme d’envoi
        </Link>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((candidate) => (
              <TabsTrigger key={candidate.key} value={candidate.key}>
                {candidate.label}
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {todo(candidate.key, byTab[candidate.key]!)}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TABS.map((candidate) => {
          const rows = byTab[candidate.key]!
          return (
            <TabsContent key={candidate.key} value={candidate.key} className="mt-4 space-y-3">
              {candidate.key === 'follow' && rows.length > 0 && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  Avant d&apos;envoyer une relance, vérifiez sur LinkedIn que la personne n&apos;a pas répondu : l&apos;extension ne
                  lit pas encore les conversations. Si elle a répondu, cliquez sur « A répondu ».
                </p>
              )}
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">{candidate.empty}</p>
              ) : candidate.key === 'review' ? (
                <ReviewPanel sequences={rows} />
              ) : (
                rows.map((sequence) => (
                  <SequenceCard
                    // Nouvelle étape, nouveau texte à envoyer : la carte repart de zéro
                    key={`${sequence.id}-${sequence.status}`}
                    sequence={sequence}
                    inviteBlocked={!caps.canInvite}
                    messageBlocked={!caps.canMessage}
                  />
                ))
              )}
            </TabsContent>
          )
        })}
      </Tabs>
    </div>
  )
}
