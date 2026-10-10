'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, Copy, ExternalLink, Loader2, Pencil, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  advanceLinkedinSequence,
  removeLinkedinSequence,
  saveLinkedinMessage,
  type LinkedinStep,
} from '@/lib/actions/linkedin-sequences'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { LinkedinSequenceRow } from '@/lib/queries/linkedin'

const STEP_TOASTS: Record<LinkedinStep, string> = {
  invited: 'Invitation notée',
  connected: 'Invitation acceptée',
  messaged: 'Message noté',
  replied: 'Réponse notée',
  stopped: 'Envoi arrêté',
}

function day(iso: string | null): string {
  return iso ? format(new Date(iso), 'd MMM', { locale: fr }) : ''
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

function statusLine(sequence: LinkedinSequenceRow): string | null {
  switch (sequence.status) {
    case 'invited':
      return `Invitation envoyée le ${day(sequence.invitedAt)}`
    case 'connected':
      return sequence.invitedAt
        ? `Invitation acceptée le ${day(sequence.connectedAt)}`
        : `Déjà en relation (noté le ${day(sequence.connectedAt)})`
    case 'messaged':
      return `Message envoyé le ${day(sequence.messagedAt)}`
    case 'replied':
      return `A répondu le ${day(sequence.repliedAt)}`
    case 'stopped':
      return `Envoi arrêté le ${day(sequence.stoppedAt)}`
    default:
      return null
  }
}

/**
 * Une personne de la file, après la relecture : son message et l'étape suivante à noter.
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
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(sequence.status === 'connected')
  const [message, setMessage] = useState(sequence.message ?? '')
  const [savedMessage, setSavedMessage] = useState(sequence.message ?? '')
  const name = personName(sequence)
  const { status } = sequence
  const sent = status === 'messaged' || status === 'replied' || status === 'stopped'

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
  const saveMessage = async () => {
    const text = message.trim()
    if (text === savedMessage.trim()) return true
    try {
      const result = await saveLinkedinMessage(sequence.id, text)
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Message non enregistré', description: result.error })
        return false
      }
    } catch {
      toast({ variant: 'destructive', title: 'Message non enregistré', description: CONNECTION_ERROR })
      return false
    }
    setSavedMessage(text)
    return true
  }

  const advance = async (step: LinkedinStep) => {
    if (step === 'stopped' && !confirm(`Arrêter l'envoi LinkedIn pour ${name} ?`)) return
    if (step === 'messaged' && !(await saveMessage())) return
    await run(() => advanceLinkedinSequence(sequence.id, step), STEP_TOASTS[step])
  }

  const remove = async () => {
    if (!confirm(`Retirer ${name} de l'envoi LinkedIn ?`)) return
    await run(() => removeLinkedinSequence(sequence.id), 'Retiré de l\'envoi')
  }

  const copyAndOpen = async () => {
    try {
      await navigator.clipboard.writeText(message.trim())
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

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PersonHeader sequence={sequence} />
        {line && <span className="text-xs text-muted-foreground shrink-0">{line}</span>}
      </div>

      {message && !editing && (
        <div className="flex items-start gap-2">
          <p className={`flex-1 whitespace-pre-line text-sm ${sent ? 'text-muted-foreground' : ''} line-clamp-4`}>{message}</p>
          {!sent && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={`Modifier le message pour ${name}`}>
              <Pencil className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
      {editing && !sent && (
        <div className="space-y-1">
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onBlur={() => void saveMessage()}
            rows={5}
            maxLength={2000}
            aria-label={`Message pour ${name}`}
          />
          <p className="text-xs text-muted-foreground">{message.trim().length} caractères</p>
        </div>
      )}

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
            <Button variant="outline" size="sm" onClick={() => advance('replied')} disabled={busy}>
              A répondu
            </Button>
          </>
        )}
        {status === 'connected' && (
          <>
            <Button variant="outline" size="sm" onClick={copyAndOpen} disabled={!message.trim()}>
              <Copy className="w-4 h-4 mr-2" />
              Copier et ouvrir LinkedIn
            </Button>
            <Button size="sm" onClick={() => advance('messaged')} disabled={busy || messageBlocked || !message.trim()}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Message envoyé
            </Button>
          </>
        )}
        {status === 'messaged' && (
          <Button size="sm" onClick={() => advance('replied')} disabled={busy}>
            A répondu
          </Button>
        )}

        {status === 'approved' && (
          <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-muted-foreground">
            <X className="w-4 h-4 mr-2" />
            Retirer
          </Button>
        )}
        {(status === 'invited' || status === 'connected' || status === 'messaged') && (
          <Button variant="ghost" size="sm" onClick={() => advance('stopped')} disabled={busy} className="text-muted-foreground">
            <X className="w-4 h-4 mr-2" />
            Arrêter
          </Button>
        )}
      </div>
    </div>
  )
}
