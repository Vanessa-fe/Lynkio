'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
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
  MAX_COMPANIES_OPTIONS,
  NAF_SECTIONS,
  RUN_HOURS,
  WEEK_DAYS,
  prospectionSettingsSchema,
  type ProspectionSettingsInput,
} from '@/lib/validations/prospection'
import { saveProspectionSettings } from '@/lib/actions/prospection'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { ProspectionSettings } from '@/types'

interface ProspectionSettingsFormProps {
  settings: ProspectionSettings | null
}

function toFormValues(settings: ProspectionSettings | null): ProspectionSettingsInput {
  if (!settings) return DEFAULT_PROSPECTION_SETTINGS
  return {
    isActive: settings.is_active,
    daysOfWeek: settings.days_of_week,
    runHour: settings.run_hour,
    departments: settings.departments,
    excludedNafSections: settings.excluded_naf_sections,
    maxCompaniesPerRun: settings.max_companies_per_run,
  }
}

export function ProspectionSettingsForm({ settings }: ProspectionSettingsFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProspectionSettingsInput>({
    resolver: zodResolver(prospectionSettingsSchema),
    defaultValues: toFormValues(settings),
  })

  const isActive = useWatch({ control, name: 'isActive' })

  const onSubmit = async (data: ProspectionSettingsInput) => {
    setIsSaving(true)
    const result = await saveProspectionSettings(data)
    setIsSaving(false)

    if (result.success) {
      toast({ title: 'Réglages enregistrés' })
      reset(data)
      router.refresh()
    } else {
      toast({
        variant: 'destructive',
        title: 'Enregistrement impossible',
        description: result.error || 'Une erreur est survenue',
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Réglages</CardTitle>
        <CardDescription>
          Sophie repère les sociétés créées récemment (publiées au BODACC) dans vos départements, puis
          les complète avec les données officielles : activité, taille, dirigeants.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-8">
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
                    {MAX_COMPANIES_OPTIONS.map((count) => (
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
              Les sociétés de ces secteurs ne sont pas ajoutées. Par défaut : holdings, immobilier (SCI),
              administrations et organismes rarement clients d&apos;un freelance.
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

        <CardFooter className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button type="submit" disabled={isSaving || !isDirty}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer les réglages'}
          </Button>
          {isDirty && <p className="text-sm text-muted-foreground">Modifications non enregistrées</p>}
        </CardFooter>
      </form>
    </Card>
  )
}
