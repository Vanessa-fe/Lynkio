'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { KeyRound, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { APPROACH_LABELS, SECTOR_GROUPS, STRATEGY_AGES, STRATEGY_SIZES, sectorGroup } from '@/lib/constants/client-sectors'
import { DEPARTMENTS } from '@/lib/validations/prospection'
import { createStrategy } from '@/lib/actions/strategies'
import { addExcludedKeywords } from '@/lib/actions/icp'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils/cn'
import { StrategyDialog } from './strategy-dialog'

type AnswerKey = 'activity' | 'clients' | 'zone' | 'exclusions' | 'constraints'

// Questions de Sophie, une à la fois. Les mêmes intitulés sont envoyés à l'IA (strategy-assistant).
const QUESTIONS: { key: AnswerKey; question: string; placeholder: string; optional?: boolean }[] = [
  {
    key: 'activity',
    question: 'Que faites-vous, et que proposez-vous à vos clients ?',
    placeholder: 'Ex. : je crée des sites vitrines et des boutiques en ligne, et j’en assure la maintenance.',
  },
  {
    key: 'clients',
    question: 'Qui sont vos clients idéaux ? Type d’entreprise, taille, secteurs…',
    placeholder: 'Ex. : des commerçants et artisans, plutôt des petites entreprises de moins de 10 personnes.',
  },
  {
    key: 'zone',
    question: 'Où se trouvent-ils ?',
    placeholder: 'Ex. : Lyon et alentours, ou toute la région Auvergne-Rhône-Alpes.',
  },
  {
    key: 'exclusions',
    question: 'Y a-t-il des entreprises que vous ne voulez pas ?',
    placeholder: 'Ex. : pas de franchises, pas de grandes enseignes.',
    optional: true,
  },
  {
    key: 'constraints',
    question: 'Des contraintes ou des objectifs ? À distance ou sur place, durée des missions…',
    placeholder: 'Ex. : je préfère travailler à distance, 2 nouveaux clients par mois.',
    optional: true,
  },
]

export type StrategyDraft = {
  name: string
  approach: 'profile' | 'partner'
  sectorGroups: string[]
  sizes: string[]
  ages: string[]
  departments: string[]
  excludeKeywords: string[]
  summary: string
  missing: string[]
}

interface StrategyAssistantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  hasAiKey: boolean
  professionKey: string | null
  defaultDepartments: string[]
  // Ouvre le formulaire classique (sans IA)
  onUseForm: () => void
}

const SIZE_LABELS = Object.fromEntries(STRATEGY_SIZES.map((size) => [size.value, size.label]))
const AGE_LABELS = Object.fromEntries(STRATEGY_AGES.map((age) => [age.value, age.label]))

/**
 * Conversation guidée : Sophie pose quelques questions, l'IA de l'utilisatrice en tire une recherche.
 * Rien n'est enregistré ni lancé avant que l'utilisatrice ait vu l'aperçu et confirmé (ou modifié).
 */
export function StrategyAssistantDialog({
  open,
  onOpenChange,
  hasAiKey,
  professionKey,
  defaultDepartments,
  onUseForm,
}: StrategyAssistantDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<AnswerKey, string>>({
    activity: '',
    clients: '',
    zone: '',
    exclusions: '',
    constraints: '',
  })
  const [draft, setDraft] = useState<StrategyDraft | null>(null)
  const [keepKeywords, setKeepKeywords] = useState(true)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  const current = QUESTIONS[step] ?? QUESTIONS[0]!
  const isLast = step === QUESTIONS.length - 1
  // Pas de zone comprise : celle des réglages de prospection, signalée comme telle
  const departments = draft && draft.departments.length > 0 ? draft.departments : defaultDepartments.slice(0, 20)
  const zoneFromSettings = !!draft && draft.departments.length === 0
  const canSaveDirectly = !!draft && draft.sectorGroups.length > 0 && departments.length > 0 && !!draft.name.trim()

  const analyze = async () => {
    setError(null)
    setIsAnalyzing(true)
    try {
      // Appel direct depuis le navigateur : l'IA prend souvent plus que le temps accordé à une action serveur
      const supabase = createClient()
      const { data, error: invokeError } = await supabase.functions.invoke<{ draft: StrategyDraft }>('strategy-assistant', {
        body: { answers, sectors: SECTOR_GROUPS.map(({ key, label }) => ({ key, label })) },
      })
      if (invokeError || !data?.draft) {
        const detail =
          invokeError instanceof FunctionsHttpError
            ? ((await invokeError.context.json().catch(() => null)) as { error?: string } | null)?.error
            : null
        setError(detail ?? CONNECTION_ERROR)
        return
      }
      setDraft(data.draft)
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveKeywords = async () => {
    if (!draft || !keepKeywords || draft.excludeKeywords.length === 0) return
    const result = await addExcludedKeywords(draft.excludeKeywords)
    if (!result.success) toast({ variant: 'destructive', title: 'Mots-clés à exclure non enregistrés', description: result.error })
  }

  const close = () => {
    onOpenChange(false)
    setStep(0)
    setDraft(null)
    setError(null)
  }

  const save = async () => {
    if (!draft || !canSaveDirectly) return
    setError(null)
    setIsSaving(true)
    try {
      const result = await createStrategy({
        name: draft.name.trim(),
        approach: draft.approach,
        sectorGroups: draft.sectorGroups,
        sizes: draft.sizes,
        ages: draft.ages,
        departments,
      })
      if (!result.success) {
        setError(result.error ?? 'Impossible d’enregistrer la recherche')
        return
      }
      await saveKeywords()
      toast({
        title: 'Recherche enregistrée',
        description: 'Sophie la lancera à chaque prospection. Vous pouvez aussi la lancer tout de suite.',
      })
      close()
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open && !editOpen} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" aria-hidden />
              Décrire votre recherche à Sophie
            </DialogTitle>
            <DialogDescription>
              Répondez avec vos mots. Sophie propose une recherche, que vous vérifiez avant de l’enregistrer.
            </DialogDescription>
          </DialogHeader>

          {!hasAiKey ? (
            <div className="space-y-4 text-sm">
              <p>
                Pour comprendre vos réponses, Sophie utilise votre propre IA (OpenAI, Gemini ou Claude). Ajoutez sa clé
                dans les paramètres, ou créez la recherche avec le formulaire, sans IA.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline">
                  <Link href="/settings/keys">
                    <KeyRound className="mr-2 h-4 w-4" />
                    Ajouter ma clé d’IA
                  </Link>
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    close()
                    onUseForm()
                  }}
                >
                  Utiliser le formulaire
                </Button>
              </div>
            </div>
          ) : !draft ? (
            <div className="space-y-4">
              {/* Questions déjà répondues, comme une conversation */}
              <ol className="space-y-3 text-sm" aria-label="Vos réponses">
                {QUESTIONS.slice(0, step).map((item) => (
                  <li key={item.key} className="space-y-1.5">
                    <p className="w-fit max-w-[90%] rounded-lg bg-muted px-3 py-2">{item.question}</p>
                    <p className="ml-auto w-fit max-w-[90%] rounded-lg bg-primary/10 px-3 py-2">
                      {answers[item.key] || <span className="text-muted-foreground">(passé)</span>}
                    </p>
                  </li>
                ))}
              </ol>

              <div className="space-y-2">
                <label htmlFor="assistant-answer" className="block w-fit max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm">
                  {current.question}
                  {current.optional && <span className="text-muted-foreground"> (facultatif)</span>}
                </label>
                <Textarea
                  id="assistant-answer"
                  value={answers[current.key]}
                  maxLength={800}
                  rows={3}
                  placeholder={current.placeholder}
                  onChange={(event) => setAnswers((previous) => ({ ...previous, [current.key]: event.target.value }))}
                />
              </div>

              {isLast && (
                <p className="text-xs text-muted-foreground">
                  Un seul appel à votre IA, payé par votre clé : en général quelques centimes au plus, gratuit avec une clé
                  Gemini gratuite. Aucune entreprise n’est recherchée à cette étape.
                </p>
              )}

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                {step > 0 && (
                  <Button type="button" variant="outline" onClick={() => setStep((value) => value - 1)} disabled={isAnalyzing}>
                    Retour
                  </Button>
                )}
                {!isLast ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (!current.optional && !answers[current.key].trim() && current.key !== 'zone') {
                        setError('Répondez en quelques mots, Sophie en a besoin')
                        return
                      }
                      setError(null)
                      setStep((value) => value + 1)
                    }}
                  >
                    {current.optional && !answers[current.key].trim() ? 'Passer' : 'Continuer'}
                  </Button>
                ) : (
                  <Button type="button" onClick={analyze} disabled={isAnalyzing}>
                    {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isAnalyzing ? 'Sophie réfléchit…' : 'Proposer ma recherche'}
                  </Button>
                )}
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg bg-muted px-3 py-2">
                <p className="font-medium">Voici ce que j’ai compris</p>
                {draft.summary && <p className="mt-1">{draft.summary}</p>}
              </div>

              <dl className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                <dt className="text-muted-foreground">Nom</dt>
                <dd>{draft.name || <span className="text-destructive">à choisir</span>}</dd>
                <dt className="text-muted-foreground">Qui</dt>
                <dd>{APPROACH_LABELS[draft.approach]}</dd>
                <dt className="text-muted-foreground">Secteurs</dt>
                <dd>
                  {draft.sectorGroups.length > 0 ? (
                    draft.sectorGroups.map((key) => sectorGroup(key)?.label ?? key).join(', ')
                  ) : (
                    <span className="text-destructive">aucun secteur reconnu : à choisir</span>
                  )}
                </dd>
                <dt className="text-muted-foreground">Taille</dt>
                <dd>{draft.sizes.map((size) => SIZE_LABELS[size] ?? size).join(', ')}</dd>
                <dt className="text-muted-foreground">Ancienneté</dt>
                <dd>{draft.ages.length > 0 ? draft.ages.map((age) => AGE_LABELS[age] ?? age).join(', ') : 'toutes'}</dd>
                <dt className="text-muted-foreground">Zone</dt>
                <dd>
                  {departments.length > 0 ? (
                    <>
                      {departments.map((code) => `${code} · ${DEPARTMENTS[code] ?? code}`).join(', ')}
                      {zoneFromSettings && <span className="text-muted-foreground"> (d’après vos réglages)</span>}
                    </>
                  ) : (
                    <span className="text-destructive">à choisir</span>
                  )}
                </dd>
              </dl>

              {draft.excludeKeywords.length > 0 && (
                <label className="flex items-start gap-2 rounded-lg border p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4"
                    checked={keepKeywords}
                    onChange={(event) => setKeepKeywords(event.target.checked)}
                  />
                  <span>
                    Écarter aussi les entreprises dont le nom contient :{' '}
                    <span className="font-medium">{draft.excludeKeywords.join(', ')}</span>
                    <span className="block text-xs text-muted-foreground">Ajouté à vos mots-clés exclus (client idéal).</span>
                  </span>
                </label>
              )}

              {draft.missing.length > 0 && (
                <div className="rounded-lg border border-dashed p-3">
                  <p className="font-medium">Ce qui me manque</p>
                  <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                    {draft.missing.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Proposition de votre IA, à vérifier. Rien n’est enregistré ni lancé avant votre confirmation.
              </p>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="ghost" onClick={() => setDraft(null)} disabled={isSaving}>
                  Revoir mes réponses
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditOpen(true)} disabled={isSaving}>
                  Modifier
                </Button>
                <Button
                  type="button"
                  onClick={save}
                  disabled={isSaving || !canSaveDirectly}
                  className={cn(!canSaveDirectly && 'hidden')}
                >
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer la recherche
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {draft && editOpen && (
        <StrategyDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          professionKey={professionKey}
          defaultDepartments={defaultDepartments}
          initial={{ ...draft, departments }}
          onSaved={() => {
            void saveKeywords()
            close()
          }}
        />
      )}
    </>
  )
}
