'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AlertTriangle, Check, Loader2, RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import {
  approveLinkedinSequences,
  removeLinkedinSequence,
  saveLinkedinTexts,
  type LinkedinTexts,
} from '@/lib/actions/linkedin-sequences'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { LinkedinSequenceRow } from '@/lib/queries/linkedin'
import { PersonHeader, personName } from './sequence-card'

type Field = keyof Required<LinkedinTexts>
type Texts = Record<Field, string>
type Sequence = { body: string; followUp1: string; followUp2: string; angle: string; warnings: string[] }

// Deux rédactions à la fois : assez rapide, sans saturer la fonction de Sophie
const PARALLEL_DRAFTS = 2

const FIELDS: { field: Field; label: string; hint: string; rows: number }[] = [
  { field: 'message', label: 'Message', hint: 'quelques heures après l\'acceptation', rows: 6 },
  { field: 'followUp1', label: 'Relance', hint: '5 jours plus tard, sans réponse', rows: 4 },
  { field: 'followUp2', label: 'Dernier message', hint: '7 jours après la relance, sans réponse', rows: 4 },
]

function textsOf(sequence: LinkedinSequenceRow): Texts {
  return { message: sequence.message ?? '', followUp1: sequence.followUp1 ?? '', followUp2: sequence.followUp2 ?? '' }
}

/**
 * Relecture : Sophie rédige la séquence de chaque personne (le message et ses deux relances),
 * l'utilisatrice la relit, la modifie si besoin et la valide d'un coup. Rien ne part sans cette
 * validation ; une relance vidée n'est pas envoyée.
 */
export function ReviewPanel({ sequences }: { sequences: LinkedinSequenceRow[] }) {
  const router = useRouter()
  const { toast } = useToast()
  const [edited, setEdited] = useState<Record<string, Partial<Texts>>>({})
  const [saved, setSaved] = useState<Record<string, Partial<Texts>>>({})
  const [notes, setNotes] = useState<Record<string, { angle: string; warnings: string[] }>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [writing, setWriting] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  // Texte affiché : ce que l'utilisatrice tape, sinon ce qui est enregistré
  const current = (sequence: LinkedinSequenceRow): Texts => ({ ...textsOf(sequence), ...saved[sequence.id], ...edited[sequence.id] })
  const savedTexts = (sequence: LinkedinSequenceRow): Texts => ({ ...textsOf(sequence), ...saved[sequence.id] })
  const angleOf = (sequence: LinkedinSequenceRow) => notes[sequence.id]?.angle ?? sequence.messageAngle ?? ''

  const withoutMessage = sequences.filter((sequence) => !current(sequence).message.trim() && !writing.has(sequence.id))
  const ready = sequences.filter((sequence) => current(sequence).message.trim() && !writing.has(sequence.id))

  const setText = (id: string, field: Field, value: string) =>
    setEdited((all) => ({ ...all, [id]: { ...all[id], [field]: value } }))

  const draftOne = async (sequence: LinkedinSequenceRow) => {
    setWriting((all) => new Set(all).add(sequence.id))
    setErrors(({ [sequence.id]: _removed, ...rest }) => rest)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke<Sequence>('draft-message', {
        body: {
          companyId: sequence.company.id,
          contactId: sequence.contact.id,
          channel: 'linkedin_message',
          situation: 'after_invitation',
          sequence: true,
        },
      })
      if (error || !data) {
        const detail =
          error instanceof FunctionsHttpError
            ? ((await error.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setErrors((all) => ({ ...all, [sequence.id]: detail ?? CONNECTION_ERROR }))
        return
      }

      const texts: Texts = { message: data.body, followUp1: data.followUp1 ?? '', followUp2: data.followUp2 ?? '' }
      setEdited(({ [sequence.id]: _replaced, ...rest }) => rest)
      setSaved((all) => ({ ...all, [sequence.id]: texts }))
      setNotes((all) => ({ ...all, [sequence.id]: { angle: data.angle, warnings: data.warnings } }))
      const result = await saveLinkedinTexts(sequence.id, texts, data.angle)
      if (!result.success) setErrors((all) => ({ ...all, [sequence.id]: result.error ?? CONNECTION_ERROR }))
    } catch {
      setErrors((all) => ({ ...all, [sequence.id]: CONNECTION_ERROR }))
    } finally {
      setWriting((all) => {
        const next = new Set(all)
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

  // Enregistrement discret en quittant un champ : rien à dire si tout va bien
  const saveOnBlur = async (sequence: LinkedinSequenceRow, field: Field) => {
    const text = current(sequence)[field].trim()
    if (text === savedTexts(sequence)[field].trim()) return
    try {
      const result = await saveLinkedinTexts(sequence.id, { [field]: text })
      if (!result.success) {
        toast({ variant: 'destructive', title: 'Message non enregistré', description: result.error })
        return
      }
      setSaved((all) => ({ ...all, [sequence.id]: { ...all[sequence.id], [field]: text } }))
    } catch {
      toast({ variant: 'destructive', title: 'Message non enregistré', description: CONNECTION_ERROR })
    }
  }

  const approve = async (items: LinkedinSequenceRow[]) => {
    setBusy(true)
    let result: Awaited<ReturnType<typeof approveLinkedinSequences>>
    try {
      result = await approveLinkedinSequences(items.map((sequence) => ({ id: sequence.id, ...current(sequence) })))
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
      title: count > 1 ? `${count} séquences validées` : 'Séquence validée',
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
          Sophie écrit les trois messages de chaque personne : le message après l&apos;acceptation de votre invitation,
          une relance 5 jours plus tard et un dernier message 7 jours après. Relisez, modifiez si besoin, puis validez :
          rien ne part sans votre accord, et tout s&apos;arrête dès que la personne répond.
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
        const texts = current(sequence)
        const isWriting = writing.has(sequence.id)
        const warnings = notes[sequence.id]?.warnings ?? []
        const angle = angleOf(sequence)
        const name = personName(sequence)
        return (
          <div key={sequence.id} className="rounded-lg border bg-card p-4 space-y-4">
            <PersonHeader sequence={sequence} />

            {isWriting ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="w-4 h-4 animate-spin" />
                Sophie écrit les messages de {name}…
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {FIELDS.map(({ field, label, hint, rows }) => {
                  const id = `${field}-${sequence.id}`
                  return (
                    <div key={field} className={`space-y-1.5 min-w-0 ${field === 'message' ? 'md:col-span-2' : ''}`}>
                      <Label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2">
                        {label}
                        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
                      </Label>
                      <Textarea
                        id={id}
                        value={texts[field]}
                        onChange={(event) => setText(sequence.id, field, event.target.value)}
                        onBlur={() => void saveOnBlur(sequence, field)}
                        rows={rows}
                        maxLength={2000}
                        placeholder={
                          field === 'message'
                            ? 'Pas encore de message : demandez-le à Sophie, ou écrivez-le vous-même.'
                            : 'Vide : pas de relance.'
                        }
                      />
                      <p className="text-xs text-muted-foreground">{texts[field].trim().length} caractères</p>
                    </div>
                  )
                })}
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
              <Button size="sm" onClick={() => approve([sequence])} disabled={busy || isWriting || !texts.message.trim()}>
                <Check className="w-4 h-4 mr-2" />
                Valider
              </Button>
              <Button variant="outline" size="sm" onClick={() => draftOne(sequence)} disabled={busy || isWriting}>
                {texts.message.trim() ? <RotateCcw className="w-4 h-4 mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {texts.message.trim() ? 'Tout réécrire' : 'Faire rédiger'}
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
