'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  AI_DEFAULT_MODELS,
  AI_KEYS_URLS,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  API_KEY_SERVICES,
  isAiProvider,
  type AiProvider,
  type ApiKeyService,
} from '@/lib/constants/api-keys'
import { ADMIN_KEY_MESSAGE, detectAiProvider } from '@/lib/ai-key-detection'
import { deleteApiKey, saveAiKey, saveApiKey, setAiProvider } from '@/lib/actions/api-keys'
import type { SavedApiKey } from '@/lib/queries/api-keys'
import type { AiKeyInput } from '@/lib/validations/api-keys'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

export function ApiKeysSettings({ savedKeys, aiProvider }: { savedKeys: SavedApiKey[]; aiProvider: AiProvider | null }) {
  const savedAi = savedKeys.filter((saved) => isAiProvider(saved.provider))
  const find = (provider: string) => savedKeys.find((saved) => saved.provider === provider) ?? null
  const otherServices = API_KEY_SERVICES.filter((service) => !isAiProvider(service.provider))

  return (
    <div className="space-y-4">
      <AiKeyCard saved={savedAi} current={aiProvider} />
      {otherServices.map((service) => (
        <ApiKeyCard key={service.provider} service={service} saved={find(service.provider)} />
      ))}
    </div>
  )
}

function aiLabel(saved: SavedApiKey): string {
  return AI_PROVIDER_LABELS[saved.provider as AiProvider] ?? saved.provider
}

// Ce qu'on dit de la clé pendant la saisie (le service est reconnu sans envoyer la clé)
function detectionHint(key: string): { text: string; tone: 'ok' | 'warning' } | null {
  if (key.trim().length < 12) return null
  const detection = detectAiProvider(key)
  if (detection.ok) return { text: `Clé ${AI_PROVIDER_LABELS[detection.provider]} reconnue`, tone: 'ok' }
  if (detection.reason === 'admin_key') return { text: ADMIN_KEY_MESSAGE, tone: 'warning' }
  return { text: 'Clé non reconnue : Filonea accepte les clés OpenAI, Claude et Gemini. Vérifiez-la, ou choisissez le service ci-dessous.', tone: 'warning' }
}

const AI_HELP = API_KEY_SERVICES.filter((service) => isAiProvider(service.provider))

// Case unique « Clé de votre IA » : on colle sa clé, Filonea reconnaît le fournisseur, la vérifie et l'enregistre
function AiKeyCard({ saved, current }: { saved: SavedApiKey[]; current: AiProvider | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [key, setKey] = useState('')
  const [service, setService] = useState('auto')
  const [model, setModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showHelp, setShowHelp] = useState(saved.length === 0)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const active = current ?? saved[0]?.provider ?? null
  const chosenService = service !== 'auto' && isAiProvider(service) ? service : null
  const hint = service === 'auto' ? detectionHint(key) : null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSaving(true)
    try {
      const result = await saveAiKey({ key, service: service as AiKeyInput['service'], model: model || undefined })
      if (!result.success) {
        setError(result.error ?? 'Clé refusée')
        return
      }
      setKey('')
      toast({
        title: `Clé ${result.serviceLabel ?? ''} vérifiée et enregistrée`,
        description: result.warning ?? 'Sophie utilise maintenant cette IA.',
      })
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  const choose = async (entry: SavedApiKey) => {
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

  const remove = async (entry: SavedApiKey) => {
    setPending(entry.provider)
    try {
      const result = await deleteApiKey(entry.provider as AiProvider)
      if (!result.success) {
        toast({ title: 'Suppression impossible', description: result.error, variant: 'destructive' })
        return
      }
      toast({ title: `Clé ${aiLabel(entry)} supprimée` })
      router.refresh()
    } catch {
      toast({ title: 'Suppression impossible', description: CONNECTION_ERROR, variant: 'destructive' })
    } finally {
      setPending(null)
      setConfirmingDelete(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Votre IA
        </CardTitle>
        <CardDescription>
          Sophie a besoin d&apos;une IA pour rédiger vos messages : ChatGPT (OpenAI), Claude (Anthropic) ou Gemini
          (Google). Créez une clé sur le site de cette IA, puis collez-la ci-dessous : Filonea s&apos;occupe du reste.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved.length > 0 && (
          <ul className="space-y-2">
            {saved.map((entry) => {
              const isActive = entry.provider === active
              return (
                <li
                  key={entry.provider}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
                    isActive ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : ''
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {isActive && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    <span className="font-medium">{aiLabel(entry)}</span>
                    <span className="text-muted-foreground">
                      clé …<code className="font-mono">{entry.keyHint}</code>
                      {entry.model ? ` · modèle ${entry.model}` : ''} · {dateFormat.format(new Date(entry.updatedAt))}
                    </span>
                    {isActive && saved.length > 1 && <span className="text-emerald-700 dark:text-emerald-400">· utilisée par Sophie</span>}
                  </span>
                  {confirmingDelete === entry.provider ? (
                    <span className="flex items-center gap-2">
                      <Button type="button" variant="destructive" size="sm" onClick={() => remove(entry)} disabled={pending !== null}>
                        {pending === entry.provider && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                        Confirmer la suppression
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(null)} disabled={pending !== null}>
                        Annuler
                      </Button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      {!isActive && (
                        <Button type="button" variant="outline" size="sm" onClick={() => choose(entry)} disabled={pending !== null}>
                          {pending === entry.provider && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                          Utiliser
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDelete(entry.provider)}>
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-1">Supprimer</span>
                      </Button>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="ai-key">{saved.length > 0 ? 'Ajouter ou remplacer une clé' : 'Clé de votre IA'}</Label>
            <Input
              id="ai-key"
              type="password"
              value={key}
              onChange={(event) => {
                setKey(event.target.value)
                setError(null)
              }}
              placeholder="Collez votre clé ici"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={error ? true : undefined}
              aria-describedby="ai-key-hint"
            />
            <p
              id="ai-key-hint"
              aria-live="polite"
              className={`text-sm ${hint?.tone === 'warning' ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}
            >
              {hint?.text}
            </p>
          </div>

          <div>
            <button
              type="button"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setShowAdvanced((shown) => !shown)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? 'Laisser Filonea reconnaître le service' : 'Choisir le service moi-même'}
            </button>
            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-lg border p-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-service">Service</Label>
                  <select
                    id="ai-service"
                    value={service}
                    onChange={(event) => {
                      setService(event.target.value)
                      setModel('')
                      setError(null)
                    }}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md"
                  >
                    <option value="auto">Reconnaître d&apos;après la clé</option>
                    {AI_PROVIDERS.map((candidate) => (
                      <option key={candidate} value={candidate}>
                        {AI_PROVIDER_LABELS[candidate]}
                      </option>
                    ))}
                  </select>
                  {chosenService && (
                    <a
                      href={AI_KEYS_URLS[chosenService]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                    >
                      Créer ma clé {AI_PROVIDER_LABELS[chosenService]}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-model">Modèle (facultatif)</Label>
                  <Input
                    id="ai-model"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder={chosenService ? `${AI_DEFAULT_MODELS[chosenService]} (conseillé)` : 'Modèle conseillé si vide'}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={isSaving || key.trim().length === 0}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vérifier et enregistrer
          </Button>
        </form>

        <div>
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setShowHelp((shown) => !shown)}
            aria-expanded={showHelp}
          >
            {showHelp ? 'Masquer l’aide' : 'Je n’ai pas encore de clé'}
          </button>
          {showHelp && (
            <div className="mt-2 space-y-3 text-sm text-muted-foreground">
              <p>
                Le plus simple : OpenAI ou Claude. Gemini est gratuit pour rédiger, mais sa recherche sur Internet demande
                la facturation Google.
              </p>
              {AI_HELP.map((help) => (
                <div key={help.provider}>
                  <p className="font-medium text-foreground">{help.label}</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-5">
                    {help.steps.map((step) => (
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
                  <p className="mt-1">{help.cost}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
