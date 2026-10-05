'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Search } from 'lucide-react'
import {
  createCompanySchema,
  sizeCategories,
  sizeCategoryLabels,
  toWebsiteUrl,
  type CreateCompanyInput,
} from '@/lib/validations/company'
import { createCompany, updateCompany } from '@/lib/actions/companies'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { technologyLabel } from '@/lib/constants/technologies'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { useToast } from '@/lib/hooks/use-toast'
import type { CompanyWithRelations, LeadSource, PipelineStage } from '@/types'

interface CompanyFormProps {
  company?: CompanyWithRelations
  stages: PipelineStage[]
  sources: LeadSource[]
}

const NONE = 'none'

export function CompanyForm({ company, stages, sources }: CompanyFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  // La stack n'est enregistrée que si une analyse a vraiment eu lieu dans ce formulaire :
  // sinon, chaque enregistrement la marquait « analysée » à la date du jour
  const [hasAnalyzed, setHasAnalyzed] = useState(false)

  const isEditing = !!company
  const defaultStage = stages.find((stage) => stage.is_default) ?? stages[0]

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<CreateCompanyInput>({
    resolver: zodResolver(createCompanySchema),
    defaultValues: company
      ? {
          name: company.name,
          website: company.website ?? '',
          registrationId: company.registration_id ?? '',
          sector: company.sector ?? '',
          sizeCategory: company.size_category,
          city: company.city ?? '',
          postalCode: company.postal_code ?? '',
          stageId: company.stage_id,
          sourceId: company.source_id,
          notes: company.notes ?? '',
          estimatedAmount: company.estimated_amount ?? '',
          nextAction: company.next_action ?? '',
          detectedStack: company.detected_stack,
        }
      : {
          stageId: defaultStage?.id ?? null,
          detectedStack: [],
        },
  })

  const detectedStack = useWatch({ control, name: 'detectedStack' }) ?? []

  // Réutilise l'analyse de site existante (déplacée avec les détecteurs à l'étape 3.3)
  const handleAnalyzeWebsite = async () => {
    const website = getValues('website')

    if (!website) {
      toast({
        variant: 'destructive',
        title: 'Site manquant',
        description: 'Renseignez d\'abord le site web à analyser',
      })
      return
    }

    setIsAnalyzing(true)

    try {
      const response = await fetch('/api/companies/detect-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: toWebsiteUrl(website) }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Analyse impossible',
          description: result.error || 'Impossible d\'analyser le site',
        })
        return
      }

      setValue('detectedStack', result.detected ?? [])
      setHasAnalyzed(true)
      toast({
        title: 'Analyse terminée',
        description: result.detected?.length
          ? `Technologies détectées : ${result.detected.map(technologyLabel).join(', ')}`
          : 'Aucune technologie reconnue',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Analyse impossible',
        description: 'Impossible d\'analyser le site',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const onSubmit = async (data: CreateCompanyInput) => {
    setError(null)
    setDuplicateId(null)
    setIsLoading(true)

    const { detectedStack, ...fields } = data
    const payload = hasAnalyzed ? { ...fields, detectedStack } : fields
    const result = isEditing ? await updateCompany(company.id, payload) : await createCompany(payload)

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      if (!isEditing && 'data' in result && result.data?.id) {
        setDuplicateId(result.data.id)
      }
      return
    }

    toast({
      title: isEditing ? 'Entreprise mise à jour' : 'Entreprise ajoutée',
      description: data.name,
    })

    const targetId = isEditing ? company.id : 'data' in result ? result.data?.id : undefined
    router.push(targetId ? `/companies/${targetId}` : '/companies')
    router.refresh()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-8 pt-6">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
              {duplicateId && (
                <>
                  {' '}
                  <Link href={`/companies/${duplicateId}`} className="underline font-medium">
                    Voir la fiche existante
                  </Link>
                </>
              )}
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Identité</h2>

            <div className="space-y-2">
              <Label htmlFor="name">
                Nom de l&apos;entreprise <span className="text-destructive">*</span>
              </Label>
              <Input id="name" placeholder="Atelier Dupont" disabled={isLoading} {...register('name')} />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Site web</Label>
              <div className="flex gap-2">
                <Input
                  id="website"
                  placeholder="atelier-dupont.fr"
                  disabled={isLoading}
                  {...register('website')}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAnalyzeWebsite}
                  disabled={isLoading || isAnalyzing}
                >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span className="ml-2 hidden sm:inline">Analyser le site</span>
                </Button>
              </div>
              {errors.website && <p className="text-sm text-destructive">{errors.website.message}</p>}
              {detectedStack.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {detectedStack.map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {technologyLabel(tech)}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Le site sert aussi à repérer les doublons et à chercher des contacts.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="registrationId">SIREN</Label>
                <Input
                  id="registrationId"
                  inputMode="numeric"
                  placeholder="123 456 789"
                  disabled={isLoading}
                  {...register('registrationId')}
                />
                {errors.registrationId && (
                  <p className="text-sm text-destructive">{errors.registrationId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sizeCategory">Taille</Label>
                <Controller
                  name="sizeCategory"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(value) =>
                        field.onChange(value === NONE ? null : (value as (typeof sizeCategories)[number]))
                      }
                      disabled={isLoading}
                    >
                      <SelectTrigger id="sizeCategory">
                        <SelectValue placeholder="Non renseignée" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Non renseignée</SelectItem>
                        {sizeCategories.map((category) => (
                          <SelectItem key={category} value={category}>
                            {sizeCategoryLabels[category]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sector">Secteur d&apos;activité</Label>
              <Input
                id="sector"
                placeholder="Commerce en ligne, cabinet comptable..."
                disabled={isLoading}
                {...register('sector')}
              />
              {errors.sector && <p className="text-sm text-destructive">{errors.sector.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" placeholder="Lyon" disabled={isLoading} {...register('city')} />
                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="postalCode">Code postal</Label>
                <Input
                  id="postalCode"
                  inputMode="numeric"
                  placeholder="69002"
                  disabled={isLoading}
                  {...register('postalCode')}
                />
                {errors.postalCode && (
                  <p className="text-sm text-destructive">{errors.postalCode.message}</p>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Suivi</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stageId">Étape du pipeline</Label>
                <Controller
                  name="stageId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="stageId">
                        <SelectValue placeholder="Sans étape" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Sans étape</SelectItem>
                        {stages.map((stage) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              {stage.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sourceId">Source</Label>
                <Controller
                  name="sourceId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(value) => field.onChange(value === NONE ? null : value)}
                      disabled={isLoading}
                    >
                      <SelectTrigger id="sourceId">
                        <SelectValue placeholder="Non renseignée" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Non renseignée</SelectItem>
                        {sources.map((source) => (
                          <SelectItem key={source.id} value={source.id}>
                            {source.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedAmount">Montant estimé (€ HT)</Label>
                <Input
                  id="estimatedAmount"
                  inputMode="decimal"
                  placeholder="6 000"
                  disabled={isLoading}
                  {...register('estimatedAmount')}
                />
                {errors.estimatedAmount && (
                  <p className="text-sm text-destructive">{errors.estimatedAmount.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextAction">Prochaine action</Label>
                <Input
                  id="nextAction"
                  placeholder="Envoyer le devis, appeler la gérante..."
                  disabled={isLoading}
                  {...register('nextAction')}
                />
                {errors.nextAction && <p className="text-sm text-destructive">{errors.nextAction.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Contexte, besoin repéré, idée d'approche..."
                disabled={isLoading}
                {...register('notes')}
              />
              {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
            </div>
          </section>

          {!isEditing && (
            <p className="text-sm text-muted-foreground">
              Vous pourrez ajouter les personnes à contacter depuis la fiche de l&apos;entreprise.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Ajouter l\'entreprise'}
          </Button>
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => router.back()}>
            Annuler
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
