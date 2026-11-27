'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { AlertTriangle, Ban, Check, Loader2, MessageCircle, RotateCcw, Sparkles, Undo2 } from 'lucide-react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { markWhatsappSent, saveWhatsappDraft } from '@/lib/actions/whatsapp'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { toWhatsAppLink } from '@/lib/phone'
import {
  WHATSAPP_CAP_MESSAGE,
  WHATSAPP_MAX_LENGTH,
  WHATSAPP_TARGET_LENGTH,
  whatsappCounterLabel,
} from '@/lib/whatsapp'
import { useToast } from '@/lib/hooks/use-toast'

// Réponse de la fonction Supabase draft-message (ce qui sert ici)
type Draft = { body: string; warnings: string[] }

// idle : pas encore de message ; ready : message prêt, modifiable ; opened : WhatsApp ouvert, en attente
// de la confirmation (ouvrir WhatsApp ne prouve pas que le message est parti)
type Step = 'idle' | 'ready' | 'opened'

interface WhatsappPanelProps {
  companyId: string
  contactId: string
  // Numéro au format E.164 (+33…)
  phone: string
  // Brouillon WhatsApp déjà enregistré pour ce contact
  draft: { id: string; content: string | null } | null
  used: number
  limit: number
  // Sans présentation, Sophie présente moins bien la freelance
  hasPitch: boolean
  onOptOut: () => void
  optOutBusy: boolean
}

/**
 * Bloc WhatsApp d'un contact (offre Pro) : Sophie rédige, l'utilisatrice relit, ouvre WhatsApp avec le
 * message déjà écrit et l'envoie elle-même, puis confirme ici. Seule la confirmation compte comme un envoi.
 */
export function WhatsappPanel({
  companyId,
  contactId,
  phone,
  draft,
  used,
  limit,
  hasPitch,
  onOptOut,
  optOutBusy,
}: WhatsappPanelProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState<Step>(draft?.content ? 'ready' : 'idle')
  const [draftId, setDraftId] = useState<string | null>(draft?.id ?? null)
  const [text, setText] = useState(draft?.content ?? '')
  // Dernier texte enregistré, pour n'enregistrer à l'ouverture que s'il a changé
  const [savedText, setSavedText] = useState(draft?.content ?? '')
  const [warnings, setWarnings] = useState<string[]>([])
  const [isWriting, setIsWriting] = useState(false)
  const [isMarking, setIsMarking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capReached = used >= limit
  const message = text.trim()

  const write = async () => {
    setError(null)
    setIsWriting(true)
    try {
      // Appel direct depuis le navigateur : la rédaction dépasse souvent le temps
      // qu'accorde l'hébergement à une action serveur
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke<Draft>('draft-message', {
        body: { companyId, channel: 'whatsapp', contactId },
      })
      if (invokeError || !data) {
        const detail =
          invokeError instanceof FunctionsHttpError
            ? ((await invokeError.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        if (!detail) posthog.captureException(invokeError ?? new Error('draft-message: réponse vide'), { channel: 'whatsapp' })
        setError(detail ?? CONNECTION_ERROR)
        return
      }

      const saved = await saveWhatsappDraft({ contactId, content: data.body, interactionId: draftId })
      if (!saved.success || !saved.data) {
        setError(saved.error ?? 'Impossible d’enregistrer le message')
        return
      }
      posthog.capture('message_drafted', { channel: 'whatsapp', has_contact: true })
      setDraftId(saved.data.interactionId)
      setText(data.body)
      setSavedText(data.body)
      setWarnings(data.warnings)
      setStep('ready')
      // Le brouillon apparaît aussi dans les échanges de la fiche
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsWriting(false)
    }
  }

  const handleOpen = () => {
    // Le lien s'ouvre tout de suite dans un nouvel onglet (ou l'application WhatsApp) ; le texte
    // modifié est enregistré en parallèle, pour le retrouver plus tard
    if (message !== savedText.trim()) {
      const content = message
      saveWhatsappDraft({ contactId, content, interactionId: draftId })
        .then((saved) => {
          if (saved.success && saved.data) {
            setDraftId(saved.data.interactionId)
            setSavedText(content)
          }
        })
        .catch(() => undefined)
    }
    posthog.capture('whatsapp_opened')
    setError(null)
    setStep('opened')
  }

  const markSent = async () => {
    if (!draftId) return
    setError(null)
    setIsMarking(true)
    let result: Awaited<ReturnType<typeof markWhatsappSent>>
    try {
      result = await markWhatsappSent(draftId, message)
    } catch {
      setError(CONNECTION_ERROR)
      return
    } finally {
      setIsMarking(false)
    }
    if (!result.success) {
      setError(result.error ?? 'Une erreur est survenue')
      return
    }
    toast({ title: 'Message WhatsApp noté comme envoyé', description: 'La fiche passe à l’étape suivante.' })
    setStep('idle')
    setDraftId(null)
    setText('')
    setSavedText('')
    setWarnings([])
    router.refresh()
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          WhatsApp
        </span>
        <span className={`text-xs tabular-nums ${capReached ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
          {whatsappCounterLabel(used, limit)}
        </span>
      </div>

      {step === 'idle' && (
        <div className="space-y-2">
          <Button size="sm" variant="outline" onClick={write} disabled={isWriting}>
            {isWriting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {isWriting ? 'Sophie rédige…' : 'Préparer un message WhatsApp'}
          </Button>
          {!hasPitch && (
            <p className="text-xs text-muted-foreground">
              Pour que Sophie vous présente bien, ajoutez votre présentation dans{' '}
              <Link href="/settings/messages" className="underline hover:text-foreground">
                Messages de Sophie
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {step === 'ready' && (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={7}
            maxLength={WHATSAPP_MAX_LENGTH}
            aria-label="Message WhatsApp"
            disabled={isWriting}
            className="bg-background"
          />
          <p className={`text-xs tabular-nums ${message.length > WHATSAPP_TARGET_LENGTH ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}`}>
            {message.length} caractères{message.length > WHATSAPP_TARGET_LENGTH && ` : visez moins de ${WHATSAPP_TARGET_LENGTH}`}
          </p>
          {warnings.length > 0 && (
            <ul className="space-y-1">
              {warnings.map((warning) => (
                <li key={warning} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}
          {capReached && <p className="text-sm text-amber-700 dark:text-amber-400">{WHATSAPP_CAP_MESSAGE}</p>}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {capReached || !message ? (
              <Button size="sm" disabled className="bg-emerald-600 hover:bg-emerald-600">
                <MessageCircle className="mr-2 h-4 w-4" />
                Ouvrir WhatsApp
              </Button>
            ) : (
              <Button size="sm" asChild className="bg-emerald-600 text-white hover:bg-emerald-700">
                <a href={toWhatsAppLink(phone, message)} target="_blank" rel="noopener noreferrer" onClick={handleOpen}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Ouvrir WhatsApp
                </a>
              </Button>
            )}
            <button
              type="button"
              onClick={write}
              disabled={isWriting}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
            >
              {isWriting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {isWriting ? 'Sophie rédige…' : 'Régénérer'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Rien n’est envoyé automatiquement : vous relisez et envoyez vous-même depuis WhatsApp.
          </p>
        </div>
      )}

      {step === 'opened' && (
        <div className="space-y-2">
          <p className="text-sm">
            Message envoyé dans WhatsApp ? Confirmez-le ici : la fiche passera à l’étape suivante.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={markSent} disabled={isMarking || capReached}>
              {isMarking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              C’est envoyé
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStep('ready')} disabled={isMarking}>
              <Undo2 className="mr-2 h-4 w-4" />
              Pas envoyé
            </Button>
          </div>
          {capReached && <p className="text-sm text-amber-700 dark:text-amber-400">{WHATSAPP_CAP_MESSAGE}</p>}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="border-t border-emerald-200/70 pt-2 dark:border-emerald-900/70">
        <button
          type="button"
          onClick={onOptOut}
          disabled={optOutBusy}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
        >
          <Ban className="h-3.5 w-3.5" />
          Ne plus contacter
        </button>
      </div>
    </div>
  )
}
