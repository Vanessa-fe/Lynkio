'use client'

import { JOB_OFFERS_ENABLED } from '@/lib/constants/features'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckCircle2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DEFAULT_PROSPECTION_SETTINGS,
  DEPARTMENTS,
  DEPARTMENT_LIST,
  INTERMEDIARY_OPTIONS,
  MAX_COMPANIES_OPTIONS,
  NAF_SECTIONS,
  PROSPECTION_SOURCES,
  RUN_HOURS,
  WEEK_DAYS,
  prospectionSettingsSchema,
  type ProspectionSettingsInput,
  type IntermediaryKey,
  type ProspectionSourceKey,
} from '@/lib/validations/prospection'
import { saveProspectionSettings } from '@/lib/actions/prospection'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ProspectionSettings } from '@/types'

interface ProspectionSettingsFormProps {
  settings: ProspectionSettings | null
  /** Limites de l'offre : jours de recherche par semaine, entreprises par recherche */
  maxDays?: number
  maxCompanies?: number
}

// Réglages enregistrés, ramenés dans les limites de l'offre (après un passage de Pro à Essentiel)
function toFormValues(settings: ProspectionSettings | null, maxDays: number, maxCompanies: number): ProspectionSettingsInput {
  const values = toSavedValues(settings)
  return {
    ...values,
    daysOfWeek: values.daysOfWeek.slice(0, maxDays),
    maxCompaniesPerRun: Math.min(values.maxCompaniesPerRun, maxCompanies),
  }
}

function toSavedValues(settings: ProspectionSettings | null): ProspectionSettingsInput {
  if (!settings) return DEFAULT_PROSPECTION_SETTINGS
  return {
    isActive: settings.is_active,
    daysOfWeek: settings.days_of_week,
    runHour: settings.run_hour,
    departments: settings.departments,
    excludedNafSections: settings.excluded_naf_sections,
    maxCompaniesPerRun: settings.max_companies_per_run,
    sources: settings.sources.filter((key): key is ProspectionSourceKey =>
      PROSPECTION_SOURCES.some((source) => source.key === key)
    ),
    acceptedIntermediaries: settings.accepted_intermediaries.filter((key): key is IntermediaryKey =>
      INTERMEDIARY_OPTIONS.some((option) => option.key === key)
    ),
  }
}

export function ProspectionSettingsForm({ settings, maxDays = 7, maxCompanies = 50 }: ProspectionSettingsFormProps) {
  const companyOptions = MAX_COMPANIES_OPTIONS.filter((count) => count <= maxCompanies)
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  // Confirmation affichée à côté du bouton, quelques secondes après l'enregistrement
  const [justSaved, setJustSaved] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProspectionSettingsInput>({
    resolver: zodResolver(prospectionSettingsSchema),
    defaultValues: toFormValues(settings, maxDays, maxCompanies),
  })

  const isActive = useWatch({ control, name: 'isActive' })

  const onSubmit = async (data: ProspectionSettingsInput) => {
    setIsSaving(true)
    let result: Awaited<ReturnType<typeof saveProspectionSettings>>
    try {
      result = await saveProspectionSettings(data)
    } catch {
      toast({ variant: 'destructive', title: 'Enregistrement impossible', description: CONNECTION_ERROR })
      return
    } finally {
      setIsSaving(false)
    }

    if (result.success) {
      toast({ title: 'Réglages enregistrés', description: 'Sophie s\'en servira dès sa prochaine recherche.' })
      reset(data)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 6000)
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Enregistrement impossible',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  // Un champ incomplet est signalé sous le champ, parfois loin du bouton : on le dit aussi ici
  const onInvalid = () => {
    toast({
      variant: 'destructive',
      title: 'Réglages incomplets',
      description: 'Une information manque ou n\'est pas valide : elle est signalée en rouge plus haut.',
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réglages de la recherche</CardTitle>
        <CardDescription>
          Sophie repère des entreprises dans vos départements, puis les complète avec les données officielles :
          ancienneté, activité, taille, dirigeants.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
        <CardContent className="space-y-8">
          {/* Quoi chercher */}
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">En plus de vos recherches</h3>
              <p className="text-sm text-muted-foreground">
                Vos recherches par profil (page Prospection) passent à chaque prospection. Vous pouvez y ajouter :
              </p>
            </div>
            <Controller
              name="sources"
              control={control}
              render={({ field }) => (
                <div className="space-y-3">
                  {PROSPECTION_SOURCES.map((source) => {
                    const checked = field.value.includes(source.key)
                    return (
                      <div key={source.key} className="flex items-start gap-2">
                        <Checkbox
                          id={`source-${source.key}`}
                          className="mt-0.5"
                          checked={checked}
                          onCheckedChange={(value) =>
                            field.onChange(
                              value === true
                                ? [...field.value, source.key]
                                : field.value.filter((key) => key !== source.key)
                            )
                          }
                          disabled={isSaving}
                        />
                        <div>
                          <Label htmlFor={`source-${source.key}`} className="leading-snug">{source.label}</Label>
                          <p className="text-sm text-muted-foreground">{source.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            />
            {errors.sources && <p className="text-sm text-destructive">{errors.sources.message}</p>}
          </section>

          {/* Intermédiaires acceptés (seulement pour les offres d'emploi, arrêtées le 13/11/2026) */}
          {JOB_OFFERS_ENABLED && (
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">Intermédiaires acceptés</h3>
              <p className="text-sm text-muted-foreground">
                Dans les offres d&apos;emploi, gardez ou écartez celles publiées par un intermédiaire plutôt que par
                l&apos;entreprise elle-même.
              </p>
            </div>
            <Controller
              name="acceptedIntermediaries"
              control={control}
              render={({ field }) => (
                <div className="space-y-3">
                  {INTERMEDIARY_OPTIONS.map((option) => {
                    const checked = field.value.includes(option.key)
                    return (
                      <div key={option.key} className="flex items-start gap-2">
                        <Checkbox
                          id={`intermediary-${option.key}`}
                          className="mt-0.5"
                          checked={checked}
                          onCheckedChange={(value) =>
                            field.onChange(
                              value === true
                                ? [...field.value, option.key]
                                : field.value.filter((key) => key !== option.key)
                            )
                          }
                          disabled={isSaving}
                        />
                        <div>
                          <Label htmlFor={`intermediary-${option.key}`} className="leading-snug">{option.label}</Label>
                          <p className="text-sm text-muted-foreground">{option.description}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            />
          </section>
          )}

          {/* Où chercher */}
          <section className="space-y-3">
            <h3 className="font-semibold">Où chercher</h3>
            <Controller
              name="departments"
              control={control}
              render={({ field }) => {
                const selected = field.value ?? []
                const available = DEPARTMENT_LIST.filter(([code]) => !selected.includes(code))

                return (
                  <div className="space-y-3">
                    <Select
                      value=""
                      onValueChange={(code) => field.onChange([...selected, code])}
                      disabled={isSaving || selected.length >= 20}
                    >
                      <SelectTrigger className="sm:w-80" aria-label="Ajouter un département">
                        <SelectValue placeholder="Ajouter un département" />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map(([code, name]) => (
                          <SelectItem key={code} value={code}>
                            {code} · {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selected.length > 0 ? (
                      <ul className="flex flex-wrap gap-2" aria-label="Départements choisis">
                        {selected.map((code) => (
                          <li
                            key={code}
                            className="inline-flex items-center gap-1 rounded-full border bg-muted/50 pl-3 pr-1 py-1 text-sm"
                          >
                            {code} · {DEPARTMENTS[code] ?? code}
                            <button
                              type="button"
                              onClick={() => field.onChange(selected.filter((item) => item !== code))}
                              className="rounded-full p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Retirer ${DEPARTMENTS[code] ?? code}`}
                              disabled={isSaving}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">Aucun département choisi.</p>
                    )}
                  </div>
                )
              }}
            />
            {errors.departments && <p className="text-sm text-destructive">{errors.departments.message}</p>}
          </section>

          {/* Quand */}
          <section className="space-y-4">
            <h3 className="font-semibold">Quand</h3>

            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="isActive"
                    checked={field.value}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    disabled={isSaving}
                  />
                  <div>
                    <Label htmlFor="isActive">Prospection automatique</Label>
                    <p className="text-sm text-muted-foreground">
                      Sans cette case, Sophie ne cherche que lorsque vous cliquez sur « Lancer maintenant ».
                    </p>
                  </div>
                </div>
              )}
            />

            <div className={cn('space-y-4', !isActive && 'opacity-60')}>
              <Controller
                name="daysOfWeek"
                control={control}
                render={({ field }) => (
                  <fieldset className="space-y-2">
                    <legend className="text-sm font-medium mb-2">Jours</legend>
                    <div className="flex flex-wrap gap-2">
                      {WEEK_DAYS.map((day) => {
                        const checked = field.value.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={checked}
                            aria-label={day.label}
                            disabled={isSaving}
                            onClick={() =>
                              field.onChange(
                                checked
                                  ? field.value.filter((value) => value !== day.value)
                                  : // Un seul jour permis (offre Essentiel) : le nouveau remplace l'ancien
                                    maxDays <= 1
                                    ? [day.value]
                                    : [...field.value, day.value]
                              )
                            }
                            className={cn(
                              'w-12 rounded-md border py-2 text-sm transition-colors',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              checked ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'
                            )}
                          >
                            {day.short}
                          </button>
                        )
                      })}
                    </div>
                    {errors.daysOfWeek && (
                      <p className="text-sm text-destructive">{errors.daysOfWeek.message}</p>
                    )}
                  </fieldset>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="runHour">Heure</Label>
                  <Controller
                    name="runHour"
                    control={control}
                    render={({ field }) => (
                      <Select
                        value={String(field.value)}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={isSaving}
                      >
                        <SelectTrigger id="runHour">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RUN_HOURS.map((hour) => (
                            <SelectItem key={hour} value={String(hour)}>
                              {hour} h
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Combien */}
          <section className="space-y-2 sm:max-w-md">
            <h3 className="font-semibold">Combien</h3>
            <Label htmlFor="maxCompaniesPerRun">Entreprises ajoutées au plus par recherche</Label>
            <Controller
              name="maxCompaniesPerRun"
              control={control}
              render={({ field }) => (
                <Select
                  value={String(field.value)}
                  onValueChange={(value) => field.onChange(Number(value))}
                  disabled={isSaving}
                >
                  <SelectTrigger id="maxCompaniesPerRun">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {companyOptions.map((count) => (
                      <SelectItem key={count} value={String(count)}>
                        {count} entreprises
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-sm text-muted-foreground">
              Mieux vaut peu d&apos;entreprises bien suivies qu&apos;une longue liste jamais traitée.
            </p>
          </section>

          {/* Secteurs ignorés */}
          <details className="group rounded-lg border p-4">
            <summary className="cursor-pointer font-semibold">Secteurs ignorés</summary>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Les sociétés des secteurs cochés ne sont pas ajoutées.
            </p>
            <Controller
              name="excludedNafSections"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(NAF_SECTIONS).map(([code, label]) => {
                    const checked = field.value.includes(code)
                    return (
                      <div key={code} className="flex items-center gap-2">
                        <Checkbox
                          id={`naf-${code}`}
                          checked={checked}
                          onCheckedChange={(value) =>
                            field.onChange(
                              value === true ? [...field.value, code] : field.value.filter((item) => item !== code)
                            )
                          }
                          disabled={isSaving}
                        />
                        <Label htmlFor={`naf-${code}`} className="font-normal">
                          {label}
                        </Label>
                      </div>
                    )
                  })}
                </div>
              )}
            />
          </details>
        </CardContent>

        {/* Tant qu'il reste des modifications, le bouton reste visible en bas de l'écran
            (au-dessus de la barre de navigation sur mobile) : l'interrupteur seul n'enregistre rien */}
        <CardFooter
          className={cn(
            'flex flex-col sm:flex-row sm:items-center gap-3',
            isDirty && 'sticky bottom-16 md:bottom-0 z-40 bg-background border-t rounded-b-lg pt-4'
          )}
        >
          <Button type="submit" disabled={isSaving || !isDirty}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer les réglages'}
          </Button>
          {isDirty ? (
            <p className="text-sm font-medium text-amber-600">Modifications non enregistrées</p>
          ) : (
            justSaved && (
              <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Réglages enregistrés
              </p>
            )
          )}
        </CardFooter>
      </form>
    </Card>
  )
}
