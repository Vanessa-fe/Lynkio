'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { CompanyScore } from '@/components/companies/company-stage-select'
import { StrategyDialog } from '@/components/prospection/strategy-dialog'
import { createStrategy } from '@/lib/actions/strategies'
import { SECTOR_GROUPS, STRATEGY_SIZES } from '@/lib/constants/client-sectors'
import { DEPARTMENTS } from '@/lib/validations/prospection'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { decideSophieAction, getSophieActionStatus } from '@/lib/actions/sophie'
import { Checkbox } from '@/components/ui/checkbox'
import { watchRun } from '@/components/prospection/run-watch'

/**
 * Cartes des réponses de Sophie (phase 3) : ce qu'elle a consulté ou préparé, présenté pour être vérifié.
 * Rien n'est enregistré ni envoyé sans un clic de l'utilisateur.
 * Même forme que supabase/functions/sophie-chat/tools.ts (type Card).
 */
export type SophieCard =
  | { type: 'companies'; title: string; items: { id: string; name: string; detail: string; score: number | null }[] }
  | {
      type: 'search_proposal'
      draft: {
        name: string
        approach: 'profile' | 'partner'
        sectorGroups: string[]
        sizes: string[]
        ages: string[]
        departments: string[]
        excludeKeywords: string[]
        summary: string
        missing: string[]
      }
    }
  | {
      type: 'action_proposal'
      actionId: string
      kind: 'log_activity' | 'create_reminder' | 'change_stage' | 'start_prospecting' | 'launch_search'
      title: string
      lines: string[]
      companyId: string | null
      reminder: { id: string; title: string } | null
    }
  | {
      type: 'outreach_draft'
      companyId: string
      companyName: string
      channel: 'email' | 'linkedin_message'
      subject: string
      body: string
      warnings: string[]
    }

export function isSophieCard(value: unknown): value is SophieCard {
  const type = (value as { type?: unknown } | null)?.type
  return type === 'companies' || type === 'search_proposal' || type === 'outreach_draft' || type === 'action_proposal'
}

export function SophieCardView({ card, professionKey }: { card: SophieCard; professionKey: string | null }) {
  if (card.type === 'companies') return <CompaniesCard card={card} />
  if (card.type === 'search_proposal') return <SearchProposalCard card={card} professionKey={professionKey} />
  if (card.type === 'action_proposal') return <ActionProposalCard card={card} />
  return <OutreachDraftCard card={card} />
}

function CardFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-[92%] space-y-2 rounded-xl border bg-card p-3 text-sm shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function CompaniesCard({ card }: { card: Extract<SophieCard, { type: 'companies' }> }) {
  return (
    <CardFrame title={card.title}>
      <ul className="divide-y">
        {card.items.map((item) => (
          <li key={item.id}>
            <Link href={`/companies/${item.id}`} className="flex items-center gap-2 rounded py-2 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CompanyScore score={item.score} />
              <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </CardFrame>
  )
}

function SearchProposalCard({
  card,
  professionKey,
}: {
  card: Extract<SophieCard, { type: 'search_proposal' }>
  professionKey: string | null
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { draft } = card
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sectors = draft.sectorGroups.map((key) => SECTOR_GROUPS.find((group) => group.key === key)?.label ?? key)
  const sizes = draft.sizes.map((value) => STRATEGY_SIZES.find((size) => size.value === value)?.label ?? value)
  const departments = draft.departments.map((code) => DEPARTMENTS[code] ?? code)
  // Une recherche sans secteur ou sans département ne peut pas s'enregistrer telle quelle : on la complète
  const complete = draft.sectorGroups.length > 0 && draft.departments.length > 0

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await createStrategy({
        name: draft.name.trim(),
        approach: draft.approach,
        sectorGroups: draft.sectorGroups,
        sizes: draft.sizes,
        ages: draft.ages,
        departments: draft.departments,
      })
      if (!result.success) {
        setError(result.error ?? 'Impossible d’enregistrer la recherche')
        return
      }
      setSaved(true)
      toast({ title: 'Recherche enregistrée', description: 'Lancez-la depuis Prospection quand vous voulez.' })
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setSaving(false)
    }
  }

  return (
    <CardFrame title={`Recherche proposée : « ${draft.name} »`}>
      <dl className="space-y-1">
        <Fact label="Secteurs" value={sectors.join(', ') || 'à préciser'} />
        <Fact label="Tailles" value={sizes.join(', ') || 'toutes'} />
        <Fact label="Où chercher" value={departments.join(', ') || 'à préciser'} />
      </dl>
      {draft.missing.length > 0 && <p className="text-xs text-muted-foreground">À préciser : {draft.missing.join(' ; ')}</p>}
      <p className="text-xs text-muted-foreground">Rien n’est enregistré ni lancé tant que vous ne validez pas.</p>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {saved ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400">
          <Check className="h-4 w-4" aria-hidden="true" />
          Recherche enregistrée.{' '}
          <Link href="/prospection" className="underline underline-offset-2">
            Voir dans Prospection
          </Link>
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {complete && (
            <Button size="sm" onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer la recherche
            </Button>
          )}
          <Button size="sm" variant={complete ? 'outline' : 'default'} onClick={() => setEditing(true)} disabled={saving}>
            {complete ? 'Modifier' : 'Compléter'}
          </Button>
        </div>
      )}
      {editing && (
        <StrategyDialog
          open={editing}
          onOpenChange={setEditing}
          professionKey={professionKey}
          defaultDepartments={draft.departments}
          initial={draft}
          onSaved={() => {
            setSaved(true)
            setEditing(false)
          }}
        />
      )}
    </CardFrame>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

function OutreachDraftCard({ card }: { card: Extract<SophieCard, { type: 'outreach_draft' }> }) {
  const { toast } = useToast()
  const [subject, setSubject] = useState(card.subject)
  const [body, setBody] = useState(card.body)
  const isEmail = card.channel === 'email'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(isEmail && subject ? `Objet : ${subject}\n\n${body}` : body)
      toast({ title: 'Brouillon copié', description: 'Collez-le dans votre messagerie, relisez-le, puis envoyez-le vous-même.' })
    } catch {
      toast({ variant: 'destructive', title: 'Copie impossible', description: 'Sélectionnez le texte et copiez-le à la main.' })
    }
  }

  return (
    <CardFrame title={`Brouillon ${isEmail ? 'd’e-mail' : 'LinkedIn'} · ${card.companyName}`}>
      {isEmail && (
        <Input value={subject} onChange={(event) => setSubject(event.target.value)} aria-label="Objet du brouillon" className="h-8 text-sm" />
      )}
      <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={8} aria-label="Texte du brouillon" className="text-sm" />
      {card.warnings.length > 0 && (
        <ul className="space-y-1 text-xs text-amber-800 dark:text-amber-300">
          {card.warnings.map((warning) => (
            <li key={warning} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {warning}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Brouillon : rien n’est envoyé. Relisez-le, puis envoyez-le vous-même.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={copy}>
          <Copy className="mr-2 h-4 w-4" />
          Copier
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/companies/${card.companyId}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Ouvrir la fiche
          </Link>
        </Button>
      </div>
    </CardFrame>
  )
}

/**
 * Récapitulatif d'une action proposée par Sophie (phase 4) : rien n'est fait avant « Confirmer ».
 * L'état réel est relu sur le serveur (une action confirmée, annulée ou expirée ne se rejoue pas).
 */
function ActionProposalCard({ card }: { card: Extract<SophieCard, { type: 'action_proposal' }> }) {
  const router = useRouter()
  const [state, setState] = useState<'loading' | 'proposed' | 'busy' | 'done' | 'refused' | 'failed' | 'expired'>('loading')
  const [message, setMessage] = useState<string | null>(null)
  const [completeReminder, setCompleteReminder] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getSophieActionStatus(card.actionId).then((status) => {
      if (cancelled) return
      if (!status) return setState('failed')
      if (status.status === 'proposed') setState('proposed')
      else if (status.status === 'executed' || status.status === 'confirmed') {
        setState('done')
        setMessage(status.message)
      } else if (status.status === 'refused') setState('refused')
      else if (status.status === 'expired') setState('expired')
      else {
        setState('failed')
        setMessage(status.error)
      }
    })
    return () => {
      cancelled = true
    }
  }, [card.actionId])

  const decide = async (decision: 'confirm' | 'refuse') => {
    setState('busy')
    try {
      const result = await decideSophieAction(card.actionId, decision, {
        completeReminderId: completeReminder && card.reminder ? card.reminder.id : null,
      })
      if (!result.success) {
        setState('failed')
        setMessage(result.error ?? 'Action impossible')
        return
      }
      setState(decision === 'confirm' ? 'done' : 'refused')
      setMessage(result.message ?? null)
      // Recherche lancée : la fenêtre de fin s'ouvrira à la fin, où que l'on soit
      if (result.runId) watchRun(result.runId)
      router.refresh()
    } catch {
      setState('failed')
      setMessage(CONNECTION_ERROR)
    }
  }

  return (
    <CardFrame title={card.title}>
      {card.lines.length > 0 && (
        <ul className="space-y-0.5 text-sm">
          {card.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      {card.reminder && state === 'proposed' && (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <Checkbox checked={completeReminder} onCheckedChange={(checked) => setCompleteReminder(checked === true)} className="mt-0.5" />
          <span>Marquer aussi la relance « {card.reminder.title} » comme faite</span>
        </label>
      )}
      {state === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Chargement" />}
      {(state === 'proposed' || state === 'busy') && (
        <>
          <p className="text-xs text-muted-foreground">Rien n’est fait tant que vous ne confirmez pas.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => decide('confirm')} disabled={state === 'busy'}>
              {state === 'busy' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmer
            </Button>
            <Button size="sm" variant="outline" onClick={() => decide('refuse')} disabled={state === 'busy'}>
              Annuler
            </Button>
          </div>
        </>
      )}
      {state === 'done' && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400" role="status">
          <Check className="h-4 w-4" aria-hidden="true" />
          {message ?? 'Fait.'}
        </p>
      )}
      {state === 'refused' && <p className="text-sm text-muted-foreground">Annulé : rien n’a été modifié.</p>}
      {state === 'expired' && <p className="text-sm text-muted-foreground">Proposition expirée : demandez à Sophie de la reproposer.</p>}
      {state === 'failed' && (
        <p className="flex items-start gap-1.5 text-sm text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {message ?? 'L’action n’a pas abouti : rien n’a été modifié.'}
        </p>
      )}
      {card.companyId && (state === 'done' || state === 'proposed') && (
        <Link href={`/companies/${card.companyId}`} className="text-xs text-primary underline-offset-2 hover:underline">
          Ouvrir la fiche
        </Link>
      )}
    </CardFrame>
  )
}
