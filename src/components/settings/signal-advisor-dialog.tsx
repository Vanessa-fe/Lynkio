'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { KeyRound, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { saveSignalRecommendation } from '@/lib/actions/signal-recommendation'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/use-toast'
import { opportunityEvent, signalDetection, type RecommendedEvent } from '../../../supabase/functions/_shared/signal-capabilities'

type Draft = { summary: string; missing: string[]; events: RecommendedEvent[]; pitch: string }

interface SignalAdvisorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasAiKey: boolean
  services: string[]
  initialPitch: string
}

/**
 * « Demander à Sophie » : elle lit vos prestations (Mon offre), propose les événements qui peuvent
 * créer un besoin chez vos clients, vous les vérifiez, puis vous les appliquez (ou non).
 */
export function SignalAdvisorDialog({ open, onOpenChange, hasAiKey, services, initialPitch }: SignalAdvisorDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pitch, setPitch] = useState(initialPitch)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [provider, setProvider] = useState('')
  const [isAsking, setIsAsking] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    onOpenChange(false)
    setDraft(null)
    setError(null)
  }

  const ask = async () => {
    setError(null)
    setIsAsking(true)
    try {
      // Appel direct depuis le navigateur : l'IA prend souvent plus que le temps accordé à une action serveur
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke<{ draft: Draft; provider: string }>(
        'signal-advisor',
        { body: { pitch } }
      )
      if (invokeError || !data?.draft) {
        const detail =
          invokeError instanceof FunctionsHttpError
            ? ((await invokeError.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setError(detail ?? CONNECTION_ERROR)
        return
      }
      setDraft(data.draft)
      setProvider(data.provider)
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsAsking(false)
    }
  }

  const apply = async () => {
    if (!draft) return
    setIsSaving(true)
    const result = await saveSignalRecommendation({
      summary: draft.summary,
      pitch: draft.pitch,
      events: draft.events,
      provider,
    })
    setIsSaving(false)
    if (!result.success) {
      setError(result.error ?? 'Enregistrement impossible')
      return
    }
    toast({
      title: 'Recommandation appliquée',
      description: 'Vos réglages manuels sont conservés. Le score de vos entreprises est recalculé.',
    })
    close()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            Vos signaux, choisis par Sophie
          </DialogTitle>
          <DialogDescription>
            Sophie part de ce que vous vendez et choisit les événements qui peuvent créer un besoin chez vos clients,
            parmi ceux qu’elle sait repérer. Vous vérifiez avant d’appliquer.
          </DialogDescription>
        </DialogHeader>

        {!hasAiKey ? (
          <div className="space-y-4 text-sm">
            <p>
              Pour comprendre vos prestations, Sophie utilise votre propre IA (OpenAI, Gemini ou Claude). Ajoutez sa clé
              dans les paramètres. Vous pouvez aussi régler vos signaux vous-même, sans IA.
            </p>
            <Button asChild variant="outline">
              <Link href="/settings/keys">
                <KeyRound className="mr-2 h-4 w-4" />
                Ajouter ma clé d’IA
              </Link>
            </Button>
          </div>
        ) : !draft ? (
          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <p className="font-medium">Vos prestations</p>
              {services.length > 0 ? (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {services.map((service) => (
                    <li key={service}>{service}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">
                  Aucune prestation dans{' '}
                  <Link href="/settings/offer" className="underline">
                    Mon offre
                  </Link>
                  . Décrivez ci-dessous ce que vous vendez, ou ajoutez-les d’abord.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="advisor-pitch">
                Ce que vous vendez concrètement{services.length > 0 && ' (facultatif)'}
              </Label>
              <Textarea
                id="advisor-pitch"
                value={pitch}
                maxLength={600}
                rows={3}
                placeholder="Ex. : je photographie les plats et les équipes des restaurants pour leurs menus, leur site et leurs réseaux."
                onChange={(event) => setPitch(event.target.value)}
              />
            </div>

            <p className="text-xs text-muted-foreground">Un seul appel à votre IA : quelques centimes au plus.</p>

            {error && (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" onClick={ask} disabled={isAsking}>
                {isAsking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                {isAsking ? 'Sophie réfléchit…' : 'Demander à Sophie'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {draft.summary && (
              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="font-medium">Voici ce que j’ai compris</p>
                <p className="mt-1">{draft.summary}</p>
              </div>
            )}

            <ol className="space-y-3">
              {draft.events.map((event) => {
                const definition = opportunityEvent(event.event)
                const mode = definition?.signal ? signalDetection(definition.signal) : null
                return (
                  <li key={event.event} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{definition?.label ?? event.event}</p>
                      <span className="text-xs text-muted-foreground">
                        {mode === 'automatic' ? `${event.weight} pts · repéré automatiquement` : mode === 'deep' ? `${event.weight} pts · repéré par l’analyse approfondie` : 'Pas encore repérable'}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{event.why}</p>
                    {event.service && <p className="mt-1 text-xs">Prestation : {event.service}</p>}
                  </li>
                )
              })}
            </ol>

            {draft.missing.length > 0 && (
              <div className="text-muted-foreground">
                <p>Pour mieux vous conseiller, il me manque :</p>
                <ul className="list-disc pl-5">
                  {draft.missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">Des pistes, pas des besoins confirmés.</p>

            {error && (
              <p className="text-destructive" role="alert">
                {error}
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={isSaving}>
                Recommencer
              </Button>
              <Button type="button" onClick={apply} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Appliquer
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
