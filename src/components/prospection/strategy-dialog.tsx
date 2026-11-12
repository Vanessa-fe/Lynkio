'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { APPROACH_LABELS, STRATEGY_AGES, STRATEGY_SIZES, sectorGroup } from '@/lib/constants/client-sectors'
import { DepartmentPicker, SectorPicker } from './strategy-pickers'
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
  // Nouvelle recherche pré-remplie (conversation guidée avec Sophie)
  initial?: { name?: string; approach?: Approach; sectorGroups?: string[]; sizes?: string[]; ages?: string[]; departments?: string[] }
  // Appelé après un enregistrement réussi
  onSaved?: () => void
}

const STEPS = ['Qui chercher', 'Quelle taille', 'Où chercher'] as const

/** Case à cocher d'une option (taille, ancienneté) */
function CheckOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
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
      <span>{children}</span>
    </button>
  )
}

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
export function StrategyDialog({
  open,
  onOpenChange,
  professionKey,
  defaultDepartments,
  strategy,
  initial,
  onSaved,
}: StrategyDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [step, setStep] = useState(0)
  const [approach, setApproach] = useState<Approach>(strategy?.approach ?? initial?.approach ?? 'profile')
  const [sectors, setSectors] = useState<string[]>(strategy?.sectorGroups ?? initial?.sectorGroups ?? [])
  const [sizes, setSizes] = useState<string[]>(strategy?.sizes ?? initial?.sizes ?? ['tpe', 'pme'])
  // Rien de coché : toutes les anciennetés
  const [ages, setAges] = useState<string[]>(strategy?.ages ?? initial?.ages ?? [])
  const [departments, setDepartments] = useState<string[]>(
    strategy?.departments ?? (initial?.departments?.length ? initial.departments : defaultDepartments.slice(0, 20))
  )
  const [name, setName] = useState(strategy?.name ?? initial?.name ?? '')
  const [nameTouched, setNameTouched] = useState(!!strategy || !!initial?.name)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveName = nameTouched ? name : suggestedName(sectors, departments)

  const reset = () => {
    setStep(0)
    setError(null)
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
      const input = { name: effectiveName.trim(), approach, sectorGroups: sectors, sizes, ages, departments }
      const result = strategy ? await updateStrategy(strategy.id, input) : await createStrategy(input)
      if (!result.success) {
        setError(result.error ?? 'Impossible d’enregistrer la recherche')
        return
      }
      toast({
        title: strategy ? 'Recherche modifiée' : 'Recherche enregistrée',
        description: 'Sophie la lancera à chaque prospection. Vous pouvez aussi la lancer tout de suite.',
      })
      onSaved?.()
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
              <SectorPicker value={sectors} onChange={setSectors} professionKey={professionKey} approach={approach} />
            </fieldset>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Quelle taille d’entreprise ?</legend>
              <p className="text-sm text-muted-foreground">
                Les entreprises sans salarié et les filiales de grands groupes sont écartées.
              </p>
              <div className="grid gap-2">
                {STRATEGY_SIZES.map((size) => (
                  <CheckOption
                    key={size.value}
                    selected={sizes.includes(size.value)}
                    onClick={() => setSizes((current) => toggle(current, size.value))}
                  >
                    {size.label}
                  </CheckOption>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Depuis combien de temps existent-elles ? (facultatif)</legend>
              <p className="text-sm text-muted-foreground">Rien de coché : toutes, quelle que soit leur ancienneté.</p>
              <div className="grid gap-2">
                {STRATEGY_AGES.map((age) => (
                  <CheckOption
                    key={age.value}
                    selected={ages.includes(age.value)}
                    onClick={() => setAges((current) => toggle(current, age.value))}
                  >
                    {age.label} <span className="text-muted-foreground">· {age.hint}</span>
                  </CheckOption>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Où se trouve leur siège ?</Label>
              <DepartmentPicker value={departments} onChange={setDepartments} />
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
