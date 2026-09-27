'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MAX_SIGNAL_WEIGHT,
  SIZE_FIT_OPTIONS,
  icpSchema,
  sizeCategories,
  sizeCategoryLabels,
  sizeFitFromCriteria,
  type IcpCriteria,
  type IcpInput,
} from '@/lib/validations/icp'
import { saveIcp } from '@/lib/actions/icp'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { IcpProfile } from '@/types'
import type { SignalWeightOption } from '@/lib/queries/icp'

interface IcpFormProps {
  icp: IcpProfile
  signals: SignalWeightOption[]
  companiesCount: number
}

function toFormValues(icp: IcpProfile, signals: SignalWeightOption[]): IcpInput {
  const criteria = (icp.criteria ?? {}) as IcpCriteria
  const overrides = (icp.signal_weights ?? {}) as Record<string, unknown>

  return {
    name: icp.name,
    sizeFit: sizeFitFromCriteria(criteria),
    signalWeights: Object.fromEntries(
      signals.map((signal) => {
        const override = overrides[signal.key]
        return [signal.key, typeof override === 'number' ? override : signal.defaultWeight]
      })
    ),
    excludeKeywords: criteria.exclude_keywords ?? [],
  }
}

export function IcpForm({ icp, signals, companiesCount }: IcpFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [keywordDraft, setKeywordDraft] = useState('')

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<IcpInput>({
    resolver: zodResolver(icpSchema),
    defaultValues: toFormValues(icp, signals),
  })

  const keywords = useWatch({ control, name: 'excludeKeywords' }) ?? []
  const professionSignals = signals.filter((signal) => signal.isProfessionSignal)
  const otherSignals = signals.filter((signal) => !signal.isProfessionSignal)

  const addKeyword = () => {
    const keyword = keywordDraft.trim().toLowerCase()
    if (keyword.length < 2 || keywords.includes(keyword)) {
      setKeywordDraft('')
      return
    }
    setValue('excludeKeywords', [...keywords, keyword], { shouldDirty: true })
    setKeywordDraft('')
  }

  const onSubmit = async (data: IcpInput) => {
    setIsSaving(true)
    const result = await saveIcp(icp.id, data)
    setIsSaving(false)

    if (!result.success) {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: result.error })
      return
    }

    toast({
      title: 'Client idéal enregistré',
      description:
        companiesCount > 0
          ? `Le score de vos ${companiesCount} entreprises a été recalculé.`
          : 'Il servira à noter les entreprises que vous ajouterez.',
    })
    reset(data)
    router.refresh()
  }

  const renderSignal = (signal: SignalWeightOption) => (
    <Controller
      key={signal.key}
      name={`signalWeights.${signal.key}`}
      control={control}
      render={({ field }) => {
        const value = typeof field.value === 'number' ? field.value : signal.defaultWeight
        const isDefault = value === signal.defaultWeight

        return (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 lg:gap-6 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <Label htmlFor={`weight-${signal.key}`}>{signal.label}</Label>
              {signal.description && <p className="text-sm text-muted-foreground">{signal.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <input
                id={`weight-${signal.key}`}
                type="range"
                min={0}
                max={MAX_SIGNAL_WEIGHT}
                step={5}
                value={value}
                onChange={(event) => field.onChange(Number(event.target.value))}
                disabled={isSaving}
                className="w-40 accent-primary"
                aria-valuetext={`${value} points`}
              />
              <span className="w-16 text-right font-medium tabular-nums">{value} pts</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn('h-8 w-8 p-0', isDefault && 'invisible')}
                onClick={() => field.onChange(signal.defaultWeight)}
                disabled={isSaving || isDefault}
                aria-label={`Revenir à la valeur par défaut (${signal.defaultWeight} points)`}
                title={`Valeur par défaut : ${signal.defaultWeight} points`}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )
      }}
    />
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nom</CardTitle>
          <CardDescription>Pour vous y retrouver si vous créez plus tard plusieurs profils.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input {...register('name')} disabled={isSaving} className="sm:max-w-md" aria-label="Nom du client idéal" />
          {errors.name && <p className="text-sm text-destructive mt-2">{errors.name.message}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Taille des entreprises</CardTitle>
          <CardDescription>
            Idéale : +{SIZE_FIT_OPTIONS[0].points} points · Acceptée : +{SIZE_FIT_OPTIONS[1].points} points ·
            Hors cible : aucun point (l&apos;entreprise n&apos;est pas écartée pour autant).
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {sizeCategories.map((category) => (
            <Controller
              key={category}
              name={`sizeFit.${category}`}
              control={control}
              render={({ field }) => (
                <fieldset className="flex flex-col md:flex-row md:items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <legend className="sr-only">{sizeCategoryLabels[category]}</legend>
                  <span className="text-sm font-medium" aria-hidden="true">
                    {sizeCategoryLabels[category]}
                  </span>
                  <div className="inline-flex rounded-md border p-0.5" role="radiogroup" aria-label={sizeCategoryLabels[category]}>
                    {SIZE_FIT_OPTIONS.map((option) => {
                      const checked = field.value === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={checked}
                          disabled={isSaving}
                          onClick={() => field.onChange(option.value)}
                          className={cn(
                            'rounded px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            checked ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          )}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signaux d&apos;achat</CardTitle>
          <CardDescription>
            Les points qu&apos;apporte chaque signal encore valide. Plusieurs signaux du même type : +5 par signal
            supplémentaire, 10 au plus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="divide-y">{professionSignals.map(renderSignal)}</div>
          {otherSignals.length > 0 && (
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">Autres signaux ({otherSignals.length})</summary>
              <p className="text-sm text-muted-foreground mt-2 mb-3">
                Prévus pour d&apos;autres métiers : sans points par défaut pour le vôtre.
              </p>
              <div className="divide-y">{otherSignals.map(renderSignal)}</div>
            </details>
          )}
          {errors.signalWeights && (
            <p className="text-sm text-destructive">Vérifiez les points : entre 0 et {MAX_SIGNAL_WEIGHT}.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mots-clés à exclure</CardTitle>
          <CardDescription>
            Une entreprise dont le nom, le secteur ou les notes contiennent l&apos;un de ces mots est écartée
            (score 0).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 sm:max-w-md">
            <Input
              value={keywordDraft}
              onChange={(event) => setKeywordDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addKeyword()
                }
              }}
              placeholder="Ex. : site vitrine"
              disabled={isSaving}
              aria-label="Nouveau mot-clé à exclure"
            />
            <Button type="button" variant="outline" onClick={addKeyword} disabled={isSaving}>
              Ajouter
            </Button>
          </div>
          {keywords.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Mots-clés exclus">
              {keywords.map((keyword) => (
                <li
                  key={keyword}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/50 pl-3 pr-1 py-1 text-sm"
                >
                  {keyword}
                  <button
                    type="button"
                    onClick={() =>
                      setValue(
                        'excludeKeywords',
                        keywords.filter((item) => item !== keyword),
                        { shouldDirty: true }
                      )
                    }
                    className="rounded-full p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Retirer ${keyword}`}
                    disabled={isSaving}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun mot-clé exclu.</p>
          )}
          {errors.excludeKeywords && (
            <p className="text-sm text-destructive">{errors.excludeKeywords.message}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Points fixes</CardTitle>
          <CardDescription>Ils complètent le score et ne se règlent pas.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between gap-4">
              <span>Dernier signal de moins de 7 jours (de moins d&apos;un mois)</span>
              <span className="font-medium tabular-nums">+10 (+5)</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Décideur identifié</span>
              <span className="font-medium tabular-nums">+5</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>E-mail de contact</span>
              <span className="font-medium tabular-nums">+5</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Site web connu</span>
              <span className="font-medium tabular-nums">+5</span>
            </li>
          </ul>
          <p className="text-sm text-muted-foreground mt-3">Le total est plafonné à 100.</p>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 md:bottom-4 z-10 flex items-center gap-3 rounded-lg border bg-background/95 p-3 shadow-sm backdrop-blur">
        <Button type="submit" disabled={isSaving || !isDirty}>
          {isSaving ? 'Enregistrement et recalcul...' : 'Enregistrer'}
        </Button>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {isDirty ? 'Non enregistré : les scores seront recalculés à l\'enregistrement.' : 'Aucune modification.'}
        </p>
      </div>
    </form>
  )
}
