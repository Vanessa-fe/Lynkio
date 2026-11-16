'use client'

import { JOB_OFFERS_ENABLED } from '@/lib/constants/features'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RotateCcw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KeywordPicker } from '@/components/settings/keyword-picker'
import { suggestKeywords } from '@/lib/actions/keyword-suggestions'
import {
  MAX_SEARCH_KEYWORDS,
  MAX_SIGNAL_WEIGHT,
  MISSION_DAYS,
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
import type { RecommendationView, SignalWeightOption } from '@/lib/queries/icp'
import { SignalAdvisorDialog } from '@/components/settings/signal-advisor-dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  SIGNAL_STATE_LABELS,
  SIGNAL_STATE_TONES,
  groupSignalsForSettings,
  signalState,
  type SignalState,
} from '@/lib/constants/signals'
import {
  DETECTABLE_TECHNOLOGIES,
  TECHNOLOGY_LABELS,
  type DetectableTechnology,
} from '@/lib/constants/technologies'

interface IcpFormProps {
  /** Mots-clés de recherche permis par l'offre */
  maxKeywords?: number
  icp: IcpProfile
  signals: SignalWeightOption[]
  companiesCount: number
  professionKey: string | null
  suggestedKeywords: string[]
  /** Dernière recommandation de Sophie appliquée */
  recommendation: RecommendationView | null
  /** Noms des prestations (Mon offre) */
  services: string[]
  hasAiKey: boolean
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
    searchKeywords: criteria.search_keywords ?? [],
    excludeKeywords: criteria.exclude_keywords ?? [],
    dayRate: typeof criteria.day_rate === 'number' ? criteria.day_rate : null,
    techStack: (criteria.tech_stack ?? []).filter((tech): tech is DetectableTechnology =>
      (DETECTABLE_TECHNOLOGIES as readonly string[]).includes(tech)
    ),
  }
}

export function IcpForm({
  icp,
  signals,
  companiesCount,
  professionKey,
  suggestedKeywords,
  recommendation,
  services,
  hasAiKey,
  maxKeywords = MAX_SEARCH_KEYWORDS,
}: IcpFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [keywordDraft, setKeywordDraft] = useState('')
  const [advisorOpen, setAdvisorOpen] = useState(false)

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
  const searchKeywords = useWatch({ control, name: 'searchKeywords' }) ?? []
  const isWebDeveloper = professionKey === 'web_developer'
  const {
    suggested: suggestedSignals,
    deep: deepSignals,
    other: otherSignals,
    unavailable: unavailableSignals,
  } = groupSignalsForSettings(signals)
  const signalWeights = useWatch({ control, name: 'signalWeights' }) ?? {}
  const detectableSignals = signals.filter((signal) => signal.availability === 'available')
  const hasCustomWeights = detectableSignals.some(
    (signal) => typeof signalWeights[signal.key] === 'number' && signalWeights[signal.key] !== signal.defaultWeight
  )
  const restoreRecommended = () => {
    for (const signal of detectableSignals) {
      setValue(`signalWeights.${signal.key}`, signal.defaultWeight, { shouldDirty: true })
    }
  }

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
        const state = signalState(signal.availability, value)

        return (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 lg:gap-6 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Label htmlFor={`weight-${signal.key}`}>{signal.label}</Label>
                <SignalStateBadge state={state} />
              </div>
              {signal.recommendation ? (
                <p className="text-sm text-muted-foreground">
                  {signal.recommendation.why}
                  {signal.recommendation.service && (
                    <span className="block text-xs mt-0.5">Prestation : {signal.recommendation.service}</span>
                  )}
                </p>
              ) : (
                signal.description && <p className="text-sm text-muted-foreground">{signal.description}</p>
              )}
              {signal.detection && (
                <p className="text-xs text-muted-foreground mt-1">Détection : {signal.detection}</p>
              )}
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
                aria-label={`Revenir à la valeur recommandée (${signal.defaultWeight} points)`}
                title={`Valeur recommandée : ${signal.defaultWeight} points`}
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
      {JOB_OFFERS_ENABLED && (
      <Card>
        <CardHeader>
          <CardTitle>Mots-clés recherchés</CardTitle>
          <CardDescription>
            Sophie cherche les offres d&apos;emploi dont l&apos;intitulé contient l&apos;un de ces mots, dans les
            départements choisis dans Prospection. Écrivez des intitulés de poste, comme ils apparaissent dans les
            annonces{isWebDeveloper ? ' ; les offres de développeur, de webmaster et du digital sont déjà cherchées pour vous' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KeywordPicker
            value={searchKeywords}
            onChange={(next) => setValue('searchKeywords', next, { shouldDirty: true })}
            suggestions={suggestedKeywords}
            max={maxKeywords}
            disabled={isSaving}
            placeholder="Ex. : graphiste, community manager"
            inputLabel="Nouveau mot-clé recherché"
            listLabel="Mots-clés recherchés"
            searchSuggestions={suggestKeywords}
          />
          {errors.searchKeywords && <p className="text-sm text-destructive mt-2">{errors.searchKeywords.message}</p>}
        </CardContent>
      </Card>
      )}

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Signaux d&apos;opportunité</CardTitle>
              <CardDescription>
                Les événements que Sophie sait repérer aujourd&apos;hui, et les points qu&apos;ils apportent tant
                qu&apos;ils sont valides. À 0 point, un signal est inactif. Plusieurs signaux du même type : +5 par
                signal supplémentaire, 10 au plus.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setAdvisorOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              {recommendation ? 'Redemander à Sophie' : 'Demander à Sophie'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {recommendation ? (
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <p>
                <span className="font-medium">Choisis par Sophie</span> le{' '}
                {new Date(recommendation.generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                {recommendation.summary && ` : ${recommendation.summary}`}
              </p>
              {recommendation.isStale && (
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  Vos prestations ont changé depuis : redemandez à Sophie pour mettre vos signaux à jour.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sophie peut choisir vos signaux à partir de vos prestations : elle explique pourquoi chacun peut créer un
              besoin chez vos clients. Sans cela, les points par défaut de votre métier s&apos;appliquent.
            </p>
          )}

          <section className="space-y-2" aria-labelledby="signals-suggested">
            <h3 id="signals-suggested" className="text-sm font-semibold">
              {recommendation ? 'Personnalisés par Sophie' : 'Signaux de votre métier'}
            </h3>
            {suggestedSignals.length > 0 ? (
              <div className="divide-y">{suggestedSignals.map(renderSignal)}</div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {recommendation
                  ? 'Aucun des signaux repérés automatiquement ne correspond à vos prestations : vos pistes sont dans l’analyse approfondie.'
                  : 'Aucun signal repéré automatiquement n’est prévu pour votre métier : vous pouvez en activer un ci-dessous.'}
              </p>
            )}
          </section>

          {deepSignals.length > 0 && (
            <section className="space-y-2 rounded-lg border p-4" aria-labelledby="signals-deep">
              <h3 id="signals-deep" className="text-sm font-semibold">
                Avec une analyse approfondie ({deepSignals.length})
              </h3>
              <p className="text-sm text-muted-foreground">
                Ces événements se trouvent sur Internet (presse, annonces de l&apos;entreprise). Sophie les cherche sur
                une fiche quand vous cliquez sur « Approfondir avec Sophie », jamais pendant les recherches. Un
                événement ne rapporte des points que s&apos;il est daté et que sa source a été vérifiée.
              </p>
              <div className="divide-y">{deepSignals.map(renderSignal)}</div>
            </section>
          )}

          {otherSignals.length > 0 && (
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">
                Autres signaux repérés automatiquement ({otherSignals.length})
              </summary>
              <p className="text-sm text-muted-foreground mt-2 mb-3">
                {recommendation
                  ? 'Sophie ne les a pas retenus pour vos prestations : activez-les si vous pensez qu’ils comptent.'
                  : 'Sans points par défaut pour votre métier : activez-les s’ils comptent pour vos prestations.'}
              </p>
              <div className="divide-y">{otherSignals.map(renderSignal)}</div>
            </details>
          )}
          {unavailableSignals.length > 0 && (
            <details className="rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">
                Pas encore détectables ({unavailableSignals.length})
              </summary>
              <p className="text-sm text-muted-foreground mt-2 mb-3">
                Aucune source fiable ne permet encore à Sophie de les repérer : ils ne rapportent aucun point pour
                l&apos;instant.
              </p>
              <ul className="divide-y">
                {unavailableSignals.map((signal) => (
                  <li key={signal.key} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{signal.label}</span>
                      <SignalStateBadge state="unavailable" />
                    </div>
                    {signal.description && <p className="text-sm text-muted-foreground">{signal.description}</p>}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {errors.signalWeights && (
            <p className="text-sm text-destructive">Vérifiez les points : entre 0 et {MAX_SIGNAL_WEIGHT}.</p>
          )}
          {hasCustomWeights && (
            <Button type="button" variant="ghost" size="sm" onClick={restoreRecommended} disabled={isSaving}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Restaurer les valeurs recommandées
            </Button>
          )}
        </CardContent>
      </Card>

      <SignalAdvisorDialog
        open={advisorOpen}
        onOpenChange={setAdvisorOpen}
        hasAiKey={hasAiKey}
        services={services}
        initialPitch={recommendation?.pitch ?? ''}
      />

      <Card>
        <CardHeader>
          <CardTitle>Votre tarif</CardTitle>
          <CardDescription>
            Sert à repérer les entreprises qui peuvent vous payer : une mission de {MISSION_DAYS} jours ne doit pas
            peser plus de 4 % de leur chiffre d&apos;affaires publié.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 sm:max-w-xs">
          <Label htmlFor="dayRate">Tarif journalier moyen (€ HT)</Label>
          <Input
            id="dayRate"
            type="number"
            inputMode="numeric"
            min={50}
            step={10}
            placeholder="600"
            disabled={isSaving}
            {...register('dayRate', { setValueAs: (value) => (value === '' || value == null ? null : Number(value)) })}
          />
          {errors.dayRate && <p className="text-sm text-destructive">{errors.dayRate.message}</p>}
        </CardContent>
      </Card>

      {(isWebDeveloper || (icp.criteria as IcpCriteria | null)?.tech_stack?.length) ? (
      <Card>
        <CardHeader>
          <CardTitle>Technologies qui vous intéressent</CardTitle>
          <CardDescription>
            Quand l&apos;analyse du site d&apos;une entreprise en détecte une, Sophie ajoute le signal « Stack
            technique compatible » à sa fiche.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Controller
            name="techStack"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DETECTABLE_TECHNOLOGIES.map((tech) => {
                  const checked = field.value.includes(tech)
                  return (
                    <div key={tech} className="flex items-center gap-2">
                      <Checkbox
                        id={`tech-${tech}`}
                        checked={checked}
                        onCheckedChange={(value) =>
                          field.onChange(
                            value === true ? [...field.value, tech] : field.value.filter((item) => item !== tech)
                          )
                        }
                        disabled={isSaving}
                      />
                      <Label htmlFor={`tech-${tech}`} className="font-normal">
                        {TECHNOLOGY_LABELS[tech]}
                      </Label>
                    </div>
                  )
                })}
              </div>
            )}
          />
          <p className="text-sm text-muted-foreground mt-3">
            Vous pouvez aussi cocher WordPress ou Webflow si vous proposez des refontes de ces sites.
          </p>
        </CardContent>
      </Card>
      ) : null}

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
          <CardTitle>Comment le score est calculé</CardTitle>
          <CardDescription>Sur 100 points, en quatre parties. Le détail de chaque fiche est affiché sur sa page.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between gap-4">
              <span>Adéquation à votre recherche : secteur, taille, zone, ancienneté (sur les critères connus)</span>
              <span className="font-medium tabular-nums shrink-0">50</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>
                Signaux d&apos;opportunité réglés ci-dessus, seulement s&apos;ils sont prouvés. Moitié des points pour une
                hypothèse ou un signal ancien.
              </span>
              <span className="font-medium tabular-nums shrink-0">35</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Fraîcheur : dernier signal de moins de 7 jours (1 mois, 3 mois)</span>
              <span className="font-medium tabular-nums shrink-0">10 (5, 2)</span>
            </li>
            <li className="flex justify-between gap-4">
              <span>Joignabilité : décideur identifié 2, e-mail de contact 2, site web connu 1</span>
              <span className="font-medium tabular-nums shrink-0">5</span>
            </li>
          </ul>
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

function SignalStateBadge({ state }: { state: SignalState }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', SIGNAL_STATE_TONES[state])}>
      {SIGNAL_STATE_LABELS[state]}
    </span>
  )
}
