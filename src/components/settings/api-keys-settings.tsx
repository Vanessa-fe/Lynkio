'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { API_KEY_SERVICES, UPCOMING_AI_PROVIDERS, type ApiKeyService } from '@/lib/constants/api-keys'
import { deleteApiKey, saveApiKey } from '@/lib/actions/api-keys'
import type { SavedApiKey } from '@/lib/queries/api-keys'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

export function ApiKeysSettings({ savedKeys }: { savedKeys: SavedApiKey[] }) {
  return (
    <div className="space-y-4">
      {API_KEY_SERVICES.map((service) => (
        <ApiKeyCard
          key={service.provider}
          service={service}
          saved={savedKeys.find((saved) => saved.provider === service.provider) ?? null}
        />
      ))}
      <p className="text-sm text-muted-foreground">
        Bientôt, vous pourrez aussi choisir une autre IA pour Sophie : {UPCOMING_AI_PROVIDERS.join(', ')}.
      </p>
    </div>
  )
}

function ApiKeyCard({ service, saved }: { service: ApiKeyService; saved: SavedApiKey | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [key, setKey] = useState('')
  const [model, setModel] = useState(saved?.model ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showSteps, setShowSteps] = useState(!saved)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const result = await saveApiKey({ provider: service.provider, key, model: model || undefined })
      if (!result.success) {
        setError(result.error ?? 'Clé refusée')
        return
      }
      setKey('')
      toast({ title: `Clé ${service.label} vérifiée et enregistrée` })
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer votre clé ${service.label} de Filonea ?`)) return
    setIsDeleting(true)
    try {
      const result = await deleteApiKey(service.provider)
      if (!result.success) {
        toast({ title: 'Suppression impossible', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: `Clé ${service.label} supprimée` })
      router.refresh()
    } catch {
      toast({ title: 'Suppression impossible', description: CONNECTION_ERROR, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-primary" />
          {service.label}
        </CardTitle>
        <CardDescription>{service.usedFor}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Clé enregistrée, se termine par <code className="font-mono">…{saved.keyHint}</code>
              {saved.model ? ` · modèle ${saved.model}` : ''} · {dateFormat.format(new Date(saved.updatedAt))}
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span className="ml-1">Supprimer</span>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{service.cost}</p>
        )}

        <div>
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setShowSteps((shown) => !shown)}
            aria-expanded={showSteps}
          >
            {showSteps ? 'Masquer les étapes' : `Comment obtenir ma clé ${service.label} ?`}
          </button>
          {showSteps && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {service.steps.map((step) => (
                <li key={step.text}>
                  {step.text}{' '}
                  {step.url && (
                    <a
                      href={step.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-primary hover:underline"
                    >
                      {step.linkLabel}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor={`key-${service.provider}`}>{saved ? 'Remplacer la clé' : 'Votre clé'}</Label>
            <Input
              id={`key-${service.provider}`}
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder={service.keyPlaceholder}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `key-error-${service.provider}` : undefined}
            />
          </div>
          {service.defaultModel && (
            <div className="space-y-1.5">
              <Label htmlFor={`model-${service.provider}`}>Modèle (facultatif)</Label>
              <Input
                id={`model-${service.provider}`}
                value={model}
                onChange={(event) => setModel(event.target.value)}
                placeholder={`${service.defaultModel} (conseillé)`}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
          )}
          {error && (
            <p id={`key-error-${service.provider}`} role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSaving || key.trim().length === 0}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vérifier et enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
