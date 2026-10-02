'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AlertTriangle, Copy, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { createCompanyInteraction } from '@/lib/actions/company-interactions'
import { contactDisplayName } from '@/lib/validations/company'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { CompanyContact } from '@/types'

type Channel = 'email' | 'linkedin_message'

// Réponse de la fonction Supabase draft-message
type Draft = {
  subject: string | null
  body: string
  angle: string
  signal: { id: string; label: string } | null
  warnings: string[]
}

const NONE = 'none'
const MAX_INSTRUCTIONS_LENGTH = 500
const LINKEDIN_TARGET_LENGTH = 600

const channelLabels: Record<Channel, string> = {
  email: 'E-mail',
  linkedin_message: 'Message LinkedIn',
}

// Le canal le plus probable pour ce contact : l'e-mail s'il est connu, sinon LinkedIn
function defaultChannel(contact: CompanyContact | undefined): Channel {
  if (contact && !contact.email && contact.linkedin_url) return 'linkedin_message'
  return 'email'
}

interface MessageDraftDialogProps {
  companyId: string
  contacts: CompanyContact[]
  // Sans présentation, les messages sont plus génériques : on le dit avant de rédiger
  hasPitch: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MessageDraftDialog({ companyId, contacts, hasPitch, open, onOpenChange }: MessageDraftDialogProps) {
  const router = useRouter()
  const { toast } = useToast()

  const reachableContacts = contacts.filter((contact) => !contact.opted_out_at)
  const firstContact = reachableContacts.find((contact) => contact.is_decision_maker) ?? reachableContacts[0]

  const [contactId, setContactId] = useState<string | null>(firstContact?.id ?? null)
  const [channel, setChannel] = useState<Channel>(defaultChannel(firstContact))
  const [instructions, setInstructions] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isWriting, setIsWriting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContactChange = (value: string) => {
    const id = value === NONE ? null : value
    setContactId(id)
    setChannel(defaultChannel(reachableContacts.find((contact) => contact.id === id)))
  }

  const handleWrite = async () => {
    setError(null)
    setIsWriting(true)
    try {
      // Appel direct depuis le navigateur : la rédaction dépasse souvent le temps
      // qu'accorde l'hébergement à une action serveur
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke<Draft>('draft-message', {
        body: { companyId, channel, contactId, instructions: instructions.trim() || null },
      })

      if (invokeError || !data) {
        const detail =
          invokeError instanceof FunctionsHttpError
            ? ((await invokeError.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setError(detail ?? CONNECTION_ERROR)
        return
      }

      setDraft(data)
      setSubject(data.subject ?? '')
      setBody(data.body)
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsWriting(false)
    }
  }

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${what} copié` })
    } catch {
      toast({ variant: 'destructive', title: 'Copie impossible', description: 'Sélectionnez le texte et copiez-le à la main.' })
    }
  }

  const handleSave = async () => {
    setError(null)
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof createCompanyInteraction>>
    try {
      result = await createCompanyInteraction({
        companyId,
        contactId,
        type: channel,
        status: 'draft',
        direction: 'outgoing',
        subject: channel === 'email' ? subject : null,
        content: body,
        occurredAt: new Date(),
      })
    } catch {
      setError(CONNECTION_ERROR)
      return
    } finally {
      setIsSaving(false)
    }

    if (!result.success) {
      setError(result.error ?? 'Une erreur est survenue')
      return
    }

    toast({
      title: 'Brouillon enregistré',
      description: 'Retrouvez-le dans les échanges. Une fois envoyé, marquez-le comme envoyé.',
    })
    onOpenChange(false)
    router.refresh()
  }

  const isBusy = isWriting || isSaving

  return (
    <Dialog open={open} onOpenChange={(next) => !isBusy && onOpenChange(next)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Préparer un message
          </DialogTitle>
          <DialogDescription>
            Sophie rédige un premier message à partir de la fiche, des signaux et du site de l&apos;entreprise.
            Relisez-le toujours avant de l&apos;envoyer.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
            {error}
          </div>
        )}

        {!draft ? (
          <div className="space-y-4">
            {!hasPitch && (
              <p className="text-sm rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Sophie ne sait encore presque rien de vous.{' '}
                <Link href="/settings/messages" className="font-medium underline">
                  Ajoutez votre présentation
                </Link>{' '}
                : vos messages seront plus personnels.
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {reachableContacts.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="draft-contact">Destinataire</Label>
                  <Select value={contactId ?? NONE} onValueChange={handleContactChange} disabled={isWriting}>
                    <SelectTrigger id="draft-contact">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>L&apos;entreprise, sans destinataire précis</SelectItem>
                      {reachableContacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contactDisplayName(contact)}
                          {contact.role && ` · ${contact.role}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="draft-channel">Canal</Label>
                <Select value={channel} onValueChange={(value) => setChannel(value as Channel)} disabled={isWriting}>
                  <SelectTrigger id="draft-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(channelLabels) as Channel[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {channelLabels[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="draft-instructions">Consignes pour Sophie (facultatif)</Label>
              <Textarea
                id="draft-instructions"
                rows={3}
                maxLength={MAX_INSTRUCTIONS_LENGTH}
                placeholder="Ex. : on s'est croisés au salon VivaTech ; insister sur la refonte de leur site ; tutoyer"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                disabled={isWriting}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isWriting}>
                Annuler
              </Button>
              <Button type="button" onClick={handleWrite} disabled={isWriting}>
                {isWriting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                {isWriting ? 'Sophie rédige... (10 à 30 secondes)' : 'Rédiger'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">Angle choisi</p>
                {draft.signal && <Badge variant="secondary">{draft.signal.label}</Badge>}
              </div>
              {draft.angle && <p className="text-sm text-muted-foreground">{draft.angle}</p>}
            </div>

            {draft.warnings.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <p className="flex items-center gap-2 text-sm font-medium mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  À vérifier avant l&apos;envoi
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {draft.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {channel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="draft-subject">Objet</Label>
                <div className="flex gap-2">
                  <Input
                    id="draft-subject"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => copy(subject, 'Objet')}
                    aria-label="Copier l'objet"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="draft-body">Message</Label>
              <Textarea
                id="draft-body"
                rows={14}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                disabled={isSaving}
              />
              {channel === 'linkedin_message' && (
                <p
                  className={`text-xs text-right tabular-nums ${body.length > LINKEDIN_TARGET_LENGTH ? 'text-amber-600' : 'text-muted-foreground'}`}
                >
                  {body.length} caractères (visez moins de {LINKEDIN_TARGET_LENGTH})
                </p>
              )}
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={isSaving}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Recommencer
              </Button>
              <div className="flex flex-col-reverse sm:flex-row gap-2">
                <Button type="button" variant="outline" onClick={() => copy(body, 'Message')}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copier le message
                </Button>
                <Button type="button" onClick={handleSave} disabled={isSaving || !body.trim()}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer en brouillon'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
