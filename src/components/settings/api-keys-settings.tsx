'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AI_PROVIDER_LABELS,
  API_KEY_SERVICES,
  CUSTOM_AI_PRESETS,
  DEFAULT_CUSTOM_AI,
  OTHER_CUSTOM_AI,
  customAiLabel,
  isAiProvider,
  type AiProvider,
  type ApiKeyService,
} from '@/lib/constants/api-keys'
import { deleteApiKey, saveApiKey, saveCustomAiKey, setAiProvider } from '@/lib/actions/api-keys'
import type { SavedApiKey } from '@/lib/queries/api-keys'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

export function ApiKeysSettings({ savedKeys, aiProvider }: { savedKeys: SavedApiKey[]; aiProvider: AiProvider | null }) {
  const savedAi = savedKeys.filter((saved) => isAiProvider(saved.provider))
  const find = (provider: string) => savedKeys.find((saved) => saved.provider === provider) ?? null
  const aiServices = API_KEY_SERVICES.filter((service) => isAiProvider(service.provider))
  const otherServices = API_KEY_SERVICES.filter((service) => !isAiProvider(service.provider))

  return (
    <div className="space-y-4">
      {savedAi.length > 1 && <AiProviderChoice saved={savedAi} current={aiProvider} />}
      {aiServices.map((service) => (
        <ApiKeyCard key={service.provider} service={service} saved={find(service.provider)} />
      ))}
      <CustomAiCard saved={find('custom')} />
      {otherServices.map((service) => (
        <ApiKeyCard key={service.provider} service={service} saved={find(service.provider)} />
      ))}
      <p className="text-sm text-muted-foreground">
        Claude (Anthropic) arrivera bientôt en direct ; en attendant, il est accessible avec OpenRouter dans « Autre IA ».
      </p>
    </div>
  )
}

// Étiquette d'une IA enregistrée : « Autre IA » porte le nom de son service
function aiLabel(saved: SavedApiKey): string {
  return saved.provider === 'custom' ? customAiLabel(saved.baseUrl) : AI_PROVIDER_LABELS[saved.provider as AiProvider]
}

function ApiKeyCard({ service, saved }: { service: ApiKeyService; saved: SavedApiKey | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [key, setKey] = useState('')
  const [model, setModel] = useState(saved?.model ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
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
      setConfirmingDelete(false)
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
            {confirmingDelete ? (
              <span className="flex items-center gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Confirmer la suppression
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
                  Annuler
                </Button>
              </span>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="h-4 w-4" />
                <span className="ml-1">Supprimer</span>
              </Button>
            )}
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

// Deux clés d'IA enregistrées : l'utilisateur choisit celle que Sophie utilise
function AiProviderChoice({ saved, current }: { saved: SavedApiKey[]; current: AiProvider | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const selected = current ?? saved[0]?.provider

  const choose = async (entry: SavedApiKey) => {
    if (entry.provider === selected) return
    setPending(entry.provider)
    try {
      const result = await setAiProvider(entry.provider)
      if (!result.success) {
        toast({ title: 'Changement impossible', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: `Sophie utilise maintenant ${aiLabel(entry)}` })
      router.refresh()
    } catch {
      toast({ title: 'Changement impossible', description: CONNECTION_ERROR, variant: 'destructive' })
    } finally {
      setPending(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">IA utilisée par Sophie</CardTitle>
        <CardDescription>Vous avez enregistré plusieurs IA : choisissez celle qui rédige vos messages.</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="IA utilisée par Sophie" className="flex flex-wrap gap-2">
          {saved.map((entry) => (
            <Button
              key={entry.provider}
              type="button"
              role="radio"
              aria-checked={entry.provider === selected}
              variant={entry.provider === selected ? 'default' : 'outline'}
              onClick={() => choose(entry)}
              disabled={pending !== null}
            >
              {pending === entry.provider && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {aiLabel(entry)}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// « Autre IA » : n'importe quel service compatible avec l'API d'OpenAI
function CustomAiCard({ saved }: { saved: SavedApiKey | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const initialPreset =
    CUSTOM_AI_PRESETS.find((preset) => preset.baseUrl && preset.baseUrl === saved?.baseUrl) ??
    (saved ? OTHER_CUSTOM_AI : DEFAULT_CUSTOM_AI)
  const [presetKey, setPresetKey] = useState(initialPreset.key)
  const [baseUrl, setBaseUrl] = useState(saved?.baseUrl ?? initialPreset.baseUrl)
  const [model, setModel] = useState(saved?.model ?? initialPreset.model)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const preset = CUSTOM_AI_PRESETS.find((candidate) => candidate.key === presetKey) ?? DEFAULT_CUSTOM_AI

  const choosePreset = (next: string) => {
    const chosen = CUSTOM_AI_PRESETS.find((candidate) => candidate.key === next) ?? DEFAULT_CUSTOM_AI
    setPresetKey(chosen.key)
    setBaseUrl(chosen.baseUrl)
    setModel(chosen.model)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const result = await saveCustomAiKey({ baseUrl, model, key })
      if (!result.success) {
        setError(result.error ?? 'Clé refusée')
        return
      }
      setKey('')
      toast({ title: 'Clé vérifiée et enregistrée', description: 'Sophie utilise maintenant cette IA.' })
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const result = await deleteApiKey('custom')
      if (!result.success) {
        toast({ title: 'Suppression impossible', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Clé supprimée' })
      router.refresh()
    } catch {
      toast({ title: 'Suppression impossible', description: CONNECTION_ERROR, variant: 'destructive' })
    } finally {
      setIsDeleting(false)
      setConfirmingDelete(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <KeyRound className="h-5 w-5 text-primary" />
          Autre IA
        </CardTitle>
        <CardDescription>
          Mistral, DeepSeek, Groq, OpenRouter (pour Claude, Llama…), Grok, ou tout service compatible avec l&apos;API
          d&apos;OpenAI : Sophie rédige vos messages avec l&apos;IA de votre choix. La recherche sur le web reste réservée
          à OpenAI et Gemini.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {customAiLabel(saved.baseUrl)} · clé …<code className="font-mono">{saved.keyHint}</code>
              {saved.model ? ` · modèle ${saved.model}` : ''}
            </span>
            {confirmingDelete ? (
              <span className="flex items-center gap-2">
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Confirmer la suppression
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)} disabled={isDeleting}>
                  Annuler
                </Button>
              </span>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
                <Trash2 className="h-4 w-4" />
                <span className="ml-1">Supprimer</span>
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="custom-ai-service">Service</Label>
            <select
              id="custom-ai-service"
              value={presetKey}
              onChange={(event) => choosePreset(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md"
            >
              {CUSTOM_AI_PRESETS.map((candidate) => (
                <option key={candidate.key} value={candidate.key}>
                  {candidate.label}
                </option>
              ))}
            </select>
            {preset.keysUrl && (
              <a
                href={preset.keysUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
              >
                Créer ma clé
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-ai-url">Adresse de l&apos;API</Label>
            <Input
              id="custom-ai-url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="https://api.exemple.com/v1"
              autoComplete="off"
              spellCheck={false}
              readOnly={preset.key !== 'other'}
              className={preset.key !== 'other' ? 'bg-muted' : undefined}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-ai-model">Modèle</Label>
            <Input
              id="custom-ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Nom du modèle, tel qu'indiqué par le service"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="custom-ai-key">{saved ? 'Remplacer la clé' : 'Votre clé'}</Label>
            <Input
              id="custom-ai-key"
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="Votre clé"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'custom-ai-error' : undefined}
            />
          </div>
          {error && (
            <p id="custom-ai-error" role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isSaving || key.trim().length === 0 || !model.trim() || !baseUrl.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vérifier et enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
