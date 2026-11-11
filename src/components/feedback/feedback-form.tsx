'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { sendFeedback } from '@/lib/actions/feedback'
import { FEEDBACK_KINDS } from '@/lib/validations/feedback'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { cn } from '@/lib/utils/cn'

type Kind = (typeof FEEDBACK_KINDS)[number]['value']

export function FeedbackForm() {
  const router = useRouter()
  const [kind, setKind] = useState<Kind>('idea')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSending(true)
    try {
      const result = await sendFeedback({ kind, message, page: document.referrer ? new URL(document.referrer).pathname : null })
      if (!result.success) {
        setError(result.error ?? 'Envoi impossible')
        return
      }
      setMessage('')
      setSent(true)
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {sent ? (
          <div role="status" className="flex flex-col items-start gap-3">
            <p className="flex items-center gap-2 font-medium text-emerald-700">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Merci, votre message est bien arrivé !
            </p>
            <Button type="button" variant="outline" onClick={() => setSent(false)}>
              Envoyer un autre message
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">C&apos;est…</legend>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_KINDS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={kind === option.value}
                    onClick={() => setKind(option.value)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      kind === option.value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-message">Votre message</Label>
              <Textarea
                id="feedback-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Ex. : j'aimerais pouvoir… / ce serait plus simple si… / quand je clique sur…, il se passe…"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'feedback-error' : undefined}
              />
              <p className="text-xs text-muted-foreground">{message.length} / 2 000</p>
            </div>
            {error && (
              <p id="feedback-error" role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={isSending || message.trim().length < 5}>
              {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
