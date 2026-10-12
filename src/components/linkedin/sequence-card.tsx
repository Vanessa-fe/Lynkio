'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Clock, Copy, ExternalLink, Loader2, Pencil, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  advanceLinkedinSequence,
  removeLinkedinSequence,
  saveLinkedinTexts,
  type LinkedinStep,
  type LinkedinTexts,
} from '@/lib/actions/linkedin-sequences'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { formatDate } from '@/lib/utils/dates'
import type { LinkedinSequenceRow } from '@/lib/queries/linkedin'

type Field = keyof Required<LinkedinTexts>

const STEP_TOASTS: Record<LinkedinStep, string> = {
  invited: 'Invitation notée',
  connected: 'Invitation acceptée',
  messaged: 'Message noté',
  followed_up_1: 'Relance notée',
  followed_up_2: 'Dernier message noté',
  replied: 'Réponse notée',
  stopped: 'Envoi arrêté',
}

function day(iso: string | null): string {
  return iso ? formatDate(iso, 'd MMM') : ''
}

export function personName(sequence: LinkedinSequenceRow): string {
  return [sequence.contact.firstName, sequence.contact.lastName].filter(Boolean).join(' ') || 'Personne sans nom'
}

/** En-tête commun : la personne, son poste, son entreprise, sa liste */
export function PersonHeader({ sequence }: { sequence: LinkedinSequenceRow }) {
  const details = [sequence.contact.role, sequence.company.isIndividual ? null : sequence.company.name].filter(Boolean)
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/companies/${sequence.company.id}`} className="font-semibold hover:underline">
          {personName(sequence)}
        </Link>
        {sequence.listName && (
          <Badge variant="secondary" className="font-normal">
            {sequence.listName}
          </Badge>
        )}
      </div>
      {details.length > 0 && <p className="text-sm text-muted-foreground line-clamp-2">{details.join(' · ')}</p>}
    </div>
  )
}

/** Le prochain texte à envoyer à la main, s'il y en a un : le message, puis les relances */
export function pendingSend(sequence: LinkedinSequenceRow): { field: Field; step: LinkedinStep; label: string; done: string } | null {
  if (sequence.status === 'connected') {
    return { field: 'message', step: 'messaged', label: 'Message', done: 'Message envoyé' }
  }
  if (sequence.status === 'messaged' && sequence.followUp1?.trim()) {
    return { field: 'followUp1', step: 'followed_up_1', label: 'Relance', done: 'Relance envoyée' }
  }
  if (sequence.status === 'followed_up_1' && sequence.followUp2?.trim()) {
    return { field: 'followUp2', step: 'followed_up_2', label: 'Dernier message', done: 'Dernier message envoyé' }
  }
  return null
}

/** La relance n'est pas encore à envoyer (5 jours après le message, 7 jours après la relance) */
export function notYetDue(sequence: LinkedinSequenceRow, now = Date.now()): boolean {
  return sequence.nextFollowUpDueAt !== null && new Date(sequence.nextFollowUpDueAt).getTime() > now
}

function statusLine(sequence: LinkedinSequenceRow): string | null {
  // « relance prévue le… », « dernier message prévu le… »
  const next = (feminine: boolean) =>
    sequence.nextFollowUpDueAt
      ? `${notYetDue(sequence) ? (feminine ? 'prévue le' : 'prévu le') : 'à envoyer depuis le'} ${day(sequence.nextFollowUpDueAt)}`
      : ''
  switch (sequence.status) {
    case 'invited':
      return `Invitation envoyée le ${day(sequence.invitedAt)}`
    case 'connected':
      return sequence.invitedAt
        ? `Invitation acceptée le ${day(sequence.connectedAt)}`
        : `Déjà en relation (noté le ${day(sequence.connectedAt)})`
    case 'messaged':
      return `Message envoyé le ${day(sequence.messagedAt)}${next(true) ? ` · relance ${next(true)}` : ''}`
    case 'followed_up_1':
      return `Relance envoyée le ${day(sequence.followUp1At)}${next(false) ? ` · dernier message ${next(false)}` : ''}`
    case 'followed_up_2':
      return `Dernier message envoyé le ${day(sequence.followUp2At)} : séquence terminée`
    case 'replied':
      return `A répondu le ${day(sequence.repliedAt)}`
    case 'stopped':
      return `Envoi arrêté le ${day(sequence.stoppedAt)}`
    default:
      return null
  }
}

// Dernier texte envoyé, montré pour mémoire
function lastSent(sequence: LinkedinSequenceRow): string | null {
  if (sequence.followUp2At) return sequence.followUp2
  if (sequence.followUp1At) return sequence.followUp1
  if (sequence.messagedAt) return sequence.message
  return null
}

/**
 * Une personne de la file, après la relecture : le texte à envoyer et l'étape suivante à noter.
 * L'envoi se fait à la main sur LinkedIn ; ici, on note ce qui est fait.
 */
export function SequenceCard({
  sequence,
  inviteBlocked,
  messageBlocked,
}: {
  sequence: LinkedinSequenceRow
  inviteBlocked: boolean
  messageBlocked: boolean
}) {
  const router = useRouter()
  const { toast } = useToast()
  const { status } = sequence
  const pending = pendingSend(sequence)
  const waiting = notYetDue(sequence)
  const beforeSending = status === 'approved' || status === 'invited'

  // Texte modifiable : celui qui part ensuite, ou le message avant l'invitation
  const field: Field | null = pending?.field ?? (beforeSending ? 'message' : null)
  const initial = field ? ((field === 'message' ? sequence.message : field === 'followUp1' ? sequence.followUp1 : sequence.followUp2) ?? '') : ''
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(pending !== null)
  const [text, setText] = useState(initial)
  const [savedText, setSavedText] = useState(initial)
  const name = personName(sequence)

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, success: string) => {
    setBusy(true)
    let result: { success: boolean; error?: string }
    try {
      result = await action()
    } catch {
      toast({ variant: 'destructive', title: 'Action impossible', description: CONNECTION_ERROR })
      return false
    } finally {
      setBusy(false)
    }
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Action impossible', description: result.error })
      return false
    }
    toast({ title: success, description: name })
    router.refresh()
    return true
  }

  // Enregistrement discret (en quittant le champ) : rien à dire si tout va bien
  const saveText = async () => {
    const trimmed = text.trim()
    if (!field || trimmed === savedText.trim()) return true
    try {
      const result = await saveLinkedinTexts(sequence.id, { [field]: trimmed })
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Message non enregistré', description: result.error })
        return false
      }
    } catch {
      toast({ variant: 'destructive', title: 'Message non enregistré', description: CONNECTION_ERROR })
      return false
    }
    setSavedText(trimmed)
    return true
  }

  const advance = async (step: LinkedinStep) => {
    if (step === 'stopped' && !confirm(`Arrêter l'envoi LinkedIn pour ${name} ?`)) return
    if (pending?.step === step && !(await saveText())) return
    await run(() => advanceLinkedinSequence(sequence.id, step), STEP_TOASTS[step])
  }

  const remove = async () => {
    if (!confirm(`Retirer ${name} de l'envoi LinkedIn ?`)) return
    await run(() => removeLinkedinSequence(sequence.id), 'Retiré de l\'envoi')
  }

  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(text.trim())
      toast({ title: 'Message copié', description: 'Ouvrez la conversation sur LinkedIn et collez-le.' })
    } catch {
      toast({ variant: 'destructive', title: 'Copie impossible', description: 'Sélectionnez le texte et copiez-le à la main.' })
    }
    if (sequence.contact.linkedinUrl) window.open(sequence.contact.linkedinUrl, '_blank', 'noopener,noreferrer')
  }

  const profileLink = sequence.contact.linkedinUrl && (
    <Button variant="outline" size="sm" asChild>
      <a href={sequence.contact.linkedinUrl} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="w-4 h-4 mr-2" />
        Ouvrir le profil
      </a>
    </Button>
  )

  const line = statusLine(sequence)
  const sentText = pending || beforeSending ? null : lastSent(sequence)
  const followUps = [sequence.followUp1, sequence.followUp2].filter((value) => value?.trim()).length

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PersonHeader sequence={sequence} />
        {line && <span className="text-xs text-muted-foreground shrink-0">{line}</span>}
      </div>

      {sequence.automationError && (
        <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          L&apos;extension n&apos;a pas pu continuer : {sequence.automationError} Cette étape se fait en un clic.
        </p>
      )}
      {field && !editing && text && (
        <div className="flex items-start gap-2">
          <p className="flex-1 whitespace-pre-line text-sm line-clamp-4">{text}</p>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Modifier le message pour ${name}`}>
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      )}
      {field && editing && (
        <div className="space-y-1">
          {pending && <p className="text-sm font-medium">{pending.label} à envoyer</p>}
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onBlur={() => void saveText()}
            rows={pending?.field === 'message' || !pending ? 5 : 4}
            maxLength={2000}
            aria-label={`${pending?.label ?? 'Message'} pour ${name}`}
          />
          <p className="text-xs text-muted-foreground">{text.trim().length} caractères</p>
        </div>
      )}
      {beforeSending && followUps > 0 && (
        <p className="text-xs text-muted-foreground">
          {followUps === 2 ? 'Relance et dernier message prévus' : '1 relance prévue'} si la personne ne répond pas.
        </p>
      )}
      {sentText && <p className="whitespace-pre-line text-sm text-muted-foreground line-clamp-4">{sentText}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {status === 'approved' && (
          <>
            {profileLink}
            <Button size="sm" onClick={() => advance('invited')} disabled={busy || inviteBlocked}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Invitation envoyée
            </Button>
            <Button variant="outline" size="sm" onClick={() => advance('connected')} disabled={busy}>
              <UserCheck className="w-4 h-4 mr-2" />
              Déjà en relation
            </Button>
          </>
        )}
        {status === 'invited' && (
          <>
            <Button size="sm" onClick={() => advance('connected')} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserCheck className="w-4 h-4 mr-2" />}
              Invitation acceptée
            </Button>
            {profileLink}
          </>
        )}
        {pending && waiting && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            {pending.label} à envoyer à partir du {day(sequence.nextFollowUpDueAt)}
          </span>
        )}
        {pending && !waiting && (
          <>
            <Button variant="outline" size="sm" onClick={copyAndOpen} disabled={!text.trim()}>
              <Copy className="w-4 h-4 mr-2" />
              Copier et ouvrir LinkedIn
            </Button>
            <Button size="sm" onClick={() => advance(pending.step)} disabled={busy || messageBlocked || !text.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              {pending.done}
            </Button>
          </>
        )}
        {['invited', 'messaged', 'followed_up_1', 'followed_up_2'].includes(status) && (
          <Button variant={pending || status === 'invited' ? 'outline' : 'default'} size="sm" onClick={() => advance('replied')} disabled={busy}>
            A répondu
          </Button>
        )}

        {status === 'approved' && (
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-muted-foreground">
            <X className="w-4 h-4 mr-2" />
            Retirer
          </Button>
        )}
        {['invited', 'connected', 'messaged', 'followed_up_1'].includes(status) && (
          <Button variant="ghost" size="sm" onClick={() => advance('stopped')} disabled={busy} className="text-muted-foreground">
            <X className="w-4 h-4 mr-2" />
            Arrêter
          </Button>
        )}
      </div>
    </div>
  )
}
