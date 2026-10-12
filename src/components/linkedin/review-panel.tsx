'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AlertTriangle, Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { approveLinkedinSequences, removeLinkedinSequence, saveLinkedinMessage } from '@/lib/actions/linkedin-sequences'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { LinkedinSequenceRow } from '@/lib/queries/linkedin'
import { PersonHeader, personName } from './sequence-card'

type Draft = { body: string; angle: string; warnings: string[] }

// Deux rédactions à la fois : assez rapide, sans saturer la fonction de Sophie
const PARALLEL_DRAFTS = 2

/**
 * Relecture : Sophie rédige le message de chaque personne, l'utilisatrice le relit,
 * le modifie si besoin et le valide. Rien ne part sans cette validation.
 */
export function ReviewPanel({ sequences }: { sequences: LinkedinSequenceRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [texts, setTexts] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, { angle: string; warnings: string[] }>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [writing, setWriting] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Texte affiché : ce que l'utilisatrice tape, sinon ce qui est enregistré
  const textOf = (sequence: LinkedinSequenceRow) => texts[sequence.id] ?? sequence.message ?? ''
  const savedOf = (sequence: LinkedinSequenceRow) => saved[sequence.id] ?? sequence.message ?? ''
  const angleOf = (sequence: LinkedinSequenceRow) => notes[sequence.id]?.angle ?? sequence.messageAngle ?? ''

  const withoutMessage = sequences.filter((sequence) => !textOf(sequence).trim() && !writing.has(sequence.id))
  const ready = sequences.filter((sequence) => textOf(sequence).trim() && !writing.has(sequence.id))

  const draftOne = async (sequence: LinkedinSequenceRow) => {
    setWriting((current) => new Set(current).add(sequence.id))
    setErrors(({ [sequence.id]: _removed, ...rest }) => rest)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke<Draft>('draft-message', {
        body: {
          companyId: sequence.company.id,
          contactId: sequence.contact.id,
          channel: 'linkedin_message',
          situation: 'after_invitation',
        },
      })
      if (error || !data) {
        const detail =
          error instanceof FunctionsHttpError
            ? ((await error.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setErrors((current) => ({ ...current, [sequence.id]: detail ?? CONNECTION_ERROR }))
        return
      }

      setTexts((current) => ({ ...current, [sequence.id]: data.body }))
      setNotes((current) => ({ ...current, [sequence.id]: { angle: data.angle, warnings: data.warnings } }))
      const result = await saveLinkedinMessage(sequence.id, data.body, data.angle)
      if (result.success) setSaved((current) => ({ ...current, [sequence.id]: data.body }))
    } catch {
      setErrors((current) => ({ ...current, [sequence.id]: CONNECTION_ERROR }))
    } finally {
      setWriting((current) => {
        const next = new Set(current)
        next.delete(sequence.id)
        return next
      })
    }
  }

  const draftAll = async () => {
    const queue = [...withoutMessage]
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await draftOne(next)
    }
    await Promise.all(Array.from({ length: PARALLEL_DRAFTS }, worker))
    router.refresh()
  }

  const saveOnBlur = async (sequence: LinkedinSequenceRow) => {
    const text = textOf(sequence).trim()
    if (text === savedOf(sequence).trim()) return
    try {
      const result = await saveLinkedinMessage(sequence.id, text)
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Message non enregistré', description: result.error })
        return
      }
      setSaved((current) => ({ ...current, [sequence.id]: text }))
    } catch {
      toast({ variant: 'destructive', title: 'Message non enregistré', description: CONNECTION_ERROR })
    }
  }

  const approve = async (items: LinkedinSequenceRow[]) => {
    setBusy(true)
    let result: Awaited<ReturnType<typeof approveLinkedinSequences>>
    try {
      result = await approveLinkedinSequences(items.map((sequence) => ({ id: sequence.id, message: textOf(sequence) })))
    } catch {
      toast({ variant: 'destructive', title: 'Validation impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setBusy(false)
    }
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Validation impossible', description: result.error })
      return
    }
    const count = result.data?.approved ?? 0
    toast({
      title: count > 1 ? `${count} messages validés` : 'Message validé',
      description: 'Les personnes passent dans « À inviter ».',
    })
    router.refresh()
  }

  const remove = async (sequence: LinkedinSequenceRow) => {
    setBusy(true)
    try {
      const result = await removeLinkedinSequence(sequence.id)
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Retrait impossible', description: result.error })
        return
      }
      toast({ title: 'Retiré de l\'envoi', description: personName(sequence) })
      router.refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Retrait impossible', description: CONNECTION_ERROR })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4">
        <p className="text-sm text-muted-foreground max-w-xl">
          Sophie écrit le message que chaque personne recevra après avoir accepté votre invitation. Relisez-le, modifiez-le
          si besoin, puis validez : rien ne part sans votre accord.
        </p>
        <div className="flex flex-wrap gap-2">
          {withoutMessage.length > 0 && (
            <Button onClick={draftAll} disabled={writing.size > 0}>
              {writing.size > 0 ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              Faire rédiger Sophie ({withoutMessage.length})
            </Button>
          )}
          {writing.size > 0 && withoutMessage.length === 0 && (
            <span className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sophie écrit…
            </span>
          )}
          {ready.length > 1 && (
            <Button variant="outline" onClick={() => approve(ready)} disabled={busy || writing.size > 0}>
              <Check className="w-4 h-4 mr-2" />
              Tout valider ({ready.length})
            </Button>
          )}
        </div>
      </div>

      {sequences.map((sequence) => {
        const text = textOf(sequence)
        const isWriting = writing.has(sequence.id)
        const warnings = notes[sequence.id]?.warnings ?? []
        const angle = angleOf(sequence)
        return (
          <div key={sequence.id} className="rounded-lg border bg-card p-4 space-y-3">
            <PersonHeader sequence={sequence} />

            {isWriting ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sophie écrit le message de {personName(sequence)}…
              </p>
            ) : (
              <div className="space-y-1">
                <Textarea
                  value={text}
                  onChange={(event) => setTexts((current) => ({ ...current, [sequence.id]: event.target.value }))}
                  onBlur={() => void saveOnBlur(sequence)}
                  rows={6}
                  maxLength={2000}
                  placeholder="Pas encore de message : demandez-le à Sophie, ou écrivez-le vous-même."
                  aria-label={`Message pour ${personName(sequence)}`}
                />
                <p className="text-xs text-muted-foreground">{text.trim().length} caractères</p>
              </div>
            )}

            {angle && !isWriting && <p className="text-xs text-muted-foreground">Angle : {angle}</p>}
            {warnings.length > 0 && (
              <ul className="space-y-1">
                {warnings.map((warning) => (
                  <li key={warning} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            )}
            {errors[sequence.id] && <p className="text-sm text-destructive">{errors[sequence.id]}</p>}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => approve([sequence])} disabled={busy || isWriting || !text.trim()}>
                <Check className="w-4 h-4 mr-2" />
                Valider
              </Button>
              <Button variant="outline" size="sm" onClick={() => draftOne(sequence)} disabled={busy || isWriting}>
                {text.trim() ? <RotateCcw className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {text.trim() ? 'Réécrire' : 'Faire rédiger'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(sequence)}
                disabled={busy || isWriting}
                className="text-muted-foreground"
              >
                <X className="w-4 h-4 mr-2" />
                Retirer
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
