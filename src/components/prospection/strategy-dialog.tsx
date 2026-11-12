'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  APPROACH_LABELS,
  SECTOR_GROUPS,
  STRATEGY_SIZES,
  sectorGroup,
  sectorSuggestions,
} from '@/lib/constants/client-sectors'
import { DEPARTMENTS, DEPARTMENT_LIST } from '@/lib/validations/prospection'
import { createStrategy, updateStrategy } from '@/lib/actions/strategies'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils/cn'
import type { StrategyOverview } from '@/lib/queries/strategies'

type Approach = 'profile' | 'partner'

interface StrategyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  professionKey: string | null
  // Départements des réglages de prospection, proposés par défaut
  defaultDepartments: string[]
  // Recherche à modifier (sinon : nouvelle recherche)
  strategy?: StrategyOverview | null
}

const STEPS = ['Qui chercher', 'Quelle taille', 'Où chercher'] as const

const APPROACH_HINTS: Record<Approach, string> = {
  profile: 'Des entreprises qui pourraient avoir besoin de vous directement.',
  partner: 'Des agences ou cabinets qui confient une partie de leurs projets à des indépendants.',
}

/** Nom proposé : premier secteur choisi et zone */
function suggestedName(sectors: string[], departments: string[]): string {
  const first = sectorGroup(sectors[0] ?? '')?.label ?? 'Ma recherche'
  const more = sectors.length > 1 ? ` (+${sectors.length - 1})` : ''
  const zone = departments.length === 1 ? ` · ${departments[0]}` : departments.length > 1 ? ` · ${departments.length} départements` : ''
  return `${first}${more}${zone}`.slice(0, 80)
}

/**
 * « Nouvelle recherche » sans IA : qui chercher (clients ou partenaires, secteurs), quelle taille, où.
 * Sophie la lance ensuite à chaque passage, dans le registre officiel des entreprises.
 */
export function StrategyDialog({ open, onOpenChange, professionKey, defaultDepartments, strategy }: StrategyDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [approach, setApproach] = useState<Approach>(strategy?.approach ?? 'profile')
  const [sectors, setSectors] = useState<string[]>(strategy?.sectorGroups ?? [])
  const [sizes, setSizes] = useState<string[]>(strategy?.sizes ?? ['tpe', 'pme'])
  const [departments, setDepartments] = useState<string[]>(strategy?.departments ?? defaultDepartments.slice(0, 20))
  const [name, setName] = useState(strategy?.name ?? '')
  const [nameTouched, setNameTouched] = useState(!!strategy)
  const [showAll, setShowAll] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const suggested = sectorSuggestions(professionKey, approach)
  const visibleSectors = useMemo(() => {
    if (showAll || suggested.length === 0) return SECTOR_GROUPS
    // Suggestions du métier, plus ce qui est déjà coché ailleurs
    return SECTOR_GROUPS.filter((group) => suggested.includes(group.key) || sectors.includes(group.key))
  }, [showAll, suggested, sectors])

  const effectiveName = nameTouched ? name : suggestedName(sectors, departments)

  const reset = () => {
    setStep(0)
    setError(null)
    setShowAll(false)
  }

  const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value])

  const stepError = (): string | null => {
    if (step === 0 && sectors.length === 0) return 'Choisissez au moins un secteur'
    if (step === 1 && sizes.length === 0) return 'Choisissez au moins une taille'
    if (step === 2 && departments.length === 0) return 'Choisissez au moins un département'
    if (step === 2 && !effectiveName.trim()) return 'Donnez un nom à cette recherche'
    return null
  }

  const next = () => {
    const message = stepError()
    setError(message)
    if (!message) setStep((current) => current + 1)
  }

  const save = async () => {
    const message = stepError()
    setError(message)
    if (message) return
    setIsSaving(true)
    try {
      const input = { name: effectiveName.trim(), approach, sectorGroups: sectors, sizes, departments }
      const result = strategy ? await updateStrategy(strategy.id, input) : await createStrategy(input)
      if (!result.success) {
        setError(result.error ?? 'Impossible d’enregistrer la recherche')
        return
      }
      toast({
        title: strategy ? 'Recherche modifiée' : 'Recherche enregistrée',
        description: 'Sophie la lancera à chaque prospection. Vous pouvez aussi la lancer tout de suite.',
      })
      onOpenChange(false)
      reset()
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value)
        if (!value) reset()
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{strategy ? 'Modifier la recherche' : 'Nouvelle recherche'}</DialogTitle>
          <DialogDescription>
            Étape {step + 1} sur 3 : {STEPS[step]}. Sophie cherchera dans le registre officiel des entreprises, sans IA.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex gap-2" aria-label="Étapes">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={cn('h-1.5 flex-1 rounded-full', index <= step ? 'bg-primary' : 'bg-muted')}
              aria-current={index === step ? 'step' : undefined}
            >
              <span className="sr-only">{label}</span>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Qui cherchez-vous ?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['profile', 'partner'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={approach === value}
                    onClick={() => setApproach(value)}
                    className={cn(
                      'rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      approach === value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    <span className="font-medium">{APPROACH_LABELS[value]}</span>
                    <span className="mt-1 block text-muted-foreground">{APPROACH_HINTS[value]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Dans quels secteurs ?</legend>
              {suggested.length > 0 && !showAll && (
                <p className="text-sm text-muted-foreground">Suggestions pour votre métier :</p>
              )}
              <div className="flex flex-wrap gap-2">
                {visibleSectors.map((group) => {
                  const selected = sectors.includes(group.key)
                  return (
                    <button
                      key={group.key}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSectors((current) => toggle(current, group.key))}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted/50'
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" aria-hidden />}
                      {group.label}
                    </button>
                  )
                })}
              </div>
              {suggested.length > 0 && (
                <Button type="button" variant="link" className="h-auto px-0" onClick={() => setShowAll((value) => !value)}>
                  {showAll ? 'Voir seulement les suggestions' : 'Voir tous les secteurs'}
                </Button>
              )}
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Quelle taille d’entreprise ?</legend>
            <p className="text-sm text-muted-foreground">
              Les entreprises sans salarié et les filiales de grands groupes sont écartées.
            </p>
            <div className="grid gap-2">
              {STRATEGY_SIZES.map((size) => {
                const selected = sizes.includes(size.value)
                return (
                  <button
                    key={size.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSizes((current) => toggle(current, size.value))}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      selected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                        selected && 'border-primary bg-primary text-primary-foreground'
                      )}
                      aria-hidden
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                    {size.label}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Où se trouve leur siège ?</Label>
              <Select
                value=""
                onValueChange={(code) => setDepartments((current) => [...current, code])}
                disabled={departments.length >= 20}
              >
                <SelectTrigger className="sm:w-80" aria-label="Ajouter un département">
                  <SelectValue placeholder="Ajouter un département" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_LIST.filter(([code]) => !departments.includes(code)).map(([code, label]) => (
                    <SelectItem key={code} value={code}>
                      {code} · {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {departments.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Départements choisis">
                  {departments.map((code) => (
                    <li key={code} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm">
                      {code} · {DEPARTMENTS[code] ?? code}
                      <button
                        type="button"
                        onClick={() => setDepartments((current) => current.filter((item) => item !== code))}
                        className="rounded-full p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`Retirer ${DEPARTMENTS[code] ?? code}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucun département choisi.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy-name">Nom de la recherche</Label>
              <Input
                id="strategy-name"
                value={effectiveName}
                maxLength={80}
                onChange={(event) => {
                  setNameTouched(true)
                  setName(event.target.value)
                }}
              />
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)} disabled={isSaving}>
              Retour
            </Button>
          )}
          {step < 2 ? (
            <Button type="button" onClick={next}>
              Continuer
            </Button>
          ) : (
            <Button type="button" onClick={save} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer la recherche
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
