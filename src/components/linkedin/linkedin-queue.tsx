'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { LinkedinCounters, LinkedinSequenceRow } from '@/lib/queries/linkedin'
import type { LinkedinSequenceStatus } from '@/types'
import { ReviewPanel } from './review-panel'
import { SequenceCard } from './sequence-card'

const TABS: { key: string; label: string; statuses: LinkedinSequenceStatus[]; empty: string }[] = [
  { key: 'review', label: 'À relire', statuses: ['to_review'], empty: 'Aucun message à relire.' },
  {
    key: 'invite',
    label: 'À inviter',
    statuses: ['approved'],
    empty: 'Personne à inviter : validez des messages dans « À relire ».',
  },
  {
    key: 'waiting',
    label: 'Invitations envoyées',
    statuses: ['invited'],
    empty: 'Aucune invitation en attente de réponse.',
  },
  {
    key: 'write',
    label: 'À écrire',
    statuses: ['connected'],
    empty: 'Personne à qui écrire : notez ici les invitations acceptées.',
  },
  { key: 'done', label: 'Suivi', statuses: ['messaged', 'replied', 'stopped'], empty: 'Aucun message envoyé pour l\'instant.' },
]

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
 * File d'envoi LinkedIn, une étape par onglet. Pour l'instant, l'envoi se fait à la main
 * sur LinkedIn (« Ouvrir le profil », « Copier et ouvrir LinkedIn ») et on note ici ce qui est fait.
 */
export function LinkedinQueue({
  sequences,
  counters,
  caps,
}: {
  sequences: LinkedinSequenceRow[]
  counters: LinkedinCounters
  caps: { invitationsPerMonth: number; actionsPerDay: number }
}) {
  const byTab = Object.fromEntries(
    TABS.map((tab) => [tab.key, sequences.filter((sequence) => tab.statuses.includes(sequence.status))])
  ) as Record<string, LinkedinSequenceRow[]>
  // Première étape où il y a quelque chose à faire (« Suivi » en dernier)
  const [tab, setTab] = useState(() => TABS.find((candidate) => byTab[candidate.key]!.length > 0)?.key ?? 'review')

  // L'onglet ouvert vient de se vider (tout validé, tout invité…) : on passe à l'étape suivante qui a du monde
  const counts = TABS.map((candidate) => byTab[candidate.key]!.length).join(',')
  const [lastCounts, setLastCounts] = useState(counts)
  if (counts !== lastCounts) {
    setLastCounts(counts)
    if (byTab[tab]!.length === 0) {
      const current = TABS.findIndex((candidate) => candidate.key === tab)
      const ordered = [...TABS.slice(current + 1), ...TABS.slice(0, current)]
      const next = ordered.find((candidate) => byTab[candidate.key]!.length > 0)
      if (next) setTab(next.key)
    }
  }

  const monthReached = counters.invitationsThisMonth >= caps.invitationsPerMonth
  const dayReached = counters.actionsToday >= caps.actionsPerDay

  if (sequences.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 py-10">
          <p className="text-muted-foreground max-w-xl">
            Aucun envoi en cours. Pour commencer, choisissez une liste dans Personnes et cliquez sur « Envoyer sur
            LinkedIn » : Sophie préparera un message pour chaque personne.
          </p>
          <Button asChild>
            <Link href="/people">
              <Users className="w-4 h-4 mr-2" />
              Aller aux listes
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-6 rounded-lg border bg-card p-4">
        <Meter label="Invitations ce mois-ci" value={counters.invitationsThisMonth} max={caps.invitationsPerMonth} />
        <Meter label="Invitations et messages aujourd'hui" value={counters.actionsToday} max={caps.actionsPerDay} />
        {(monthReached || dayReached) && (
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 basis-full">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {monthReached
              ? 'Plafond du mois atteint : les invitations reprendront le mois prochain.'
              : 'Plafond du jour atteint : la suite demain.'}
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList>
            {TABS.map((candidate) => (
              <TabsTrigger key={candidate.key} value={candidate.key}>
                {candidate.label}
                <span className="ml-1.5 tabular-nums text-muted-foreground">{byTab[candidate.key]!.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {TABS.map((candidate) => {
          const rows = byTab[candidate.key]!
          return (
            <TabsContent key={candidate.key} value={candidate.key} className="mt-4 space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">{candidate.empty}</p>
              ) : candidate.key === 'review' ? (
                <ReviewPanel sequences={rows} />
              ) : (
                rows.map((sequence) => (
                  <SequenceCard
                    key={sequence.id}
                    sequence={sequence}
                    inviteBlocked={monthReached || dayReached}
                    messageBlocked={dayReached}
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
