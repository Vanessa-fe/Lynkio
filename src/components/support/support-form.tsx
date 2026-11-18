'use client'

import { useState, type FormEvent } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendSupportMessage } from '@/lib/actions/support'
import { SUPPORT_TOPICS } from '@/lib/validations/support'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { LEGAL } from '@/lib/constants/legal'
import { cn } from '@/lib/utils/cn'

type Topic = (typeof SUPPORT_TOPICS)[number]['value']

/**
 * Formulaire d'aide (vers support@filonea.fr), le même pour les visiteurs et dans l'application.
 * Connecté, le nom et l'adresse sont déjà remplis.
 */
export function SupportForm({ defaultName = '', defaultEmail = '' }: { defaultName?: string; defaultEmail?: string }) {
  const [startedAt] = useState(() => Date.now())
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [topic, setTopic] = useState<Topic>('question')
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSending(true)
    try {
      const result = await sendSupportMessage({ name, email, topic, message, website, startedAt })
      if (!result.success) {
        setError(result.error ?? 'Envoi impossible')
        return
      }
      setMessage('')
      setSent(true)
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSending(false)
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3">
        <p className="flex items-center gap-2 font-medium text-emerald-700">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
          Message envoyé, merci !
        </p>
        <p className="text-sm text-muted-foreground">
          Nous vous répondons par e-mail, à l&apos;adresse {email}, en général sous un jour ouvré.
        </p>
        <Button type="button" variant="outline" onClick={() => setSent(false)}>
          Envoyer un autre message
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="support-name">Votre prénom ou votre nom</Label>
          <Input id="support-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} autoComplete="name" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="support-email">Votre adresse e-mail</Label>
          <Input
            id="support-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            autoComplete="email"
            required
          />
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">C&apos;est à propos de…</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPORT_TOPICS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={topic === option.value}
              onClick={() => setTopic(option.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                topic === option.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="support-message">Votre message</Label>
        <Textarea
          id="support-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={7}
          maxLength={4000}
          placeholder="Ex. : quand je clique sur…, il se passe… / je voudrais savoir si…"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'support-error' : undefined}
        />
        <p className="text-xs text-muted-foreground">{message.length} / 4 000</p>
      </div>

      {/* Piège à robots : invisible et hors de la navigation au clavier, une personne le laisse vide */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="support-website">Laissez ce champ vide</label>
        <input id="support-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </div>

      {error && (
        <p id="support-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" disabled={isSending || message.trim().length < 10 || !name.trim() || !email.trim()}>
          {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Envoyer
        </Button>
        <p className="text-xs text-muted-foreground">
          Ou par e-mail : <a href={`mailto:${LEGAL.supportEmail}`} className="underline">{LEGAL.supportEmail}</a>
        </p>
      </div>
    </form>
  )
}
