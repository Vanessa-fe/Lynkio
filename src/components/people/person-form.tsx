'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, ListPlus, User } from 'lucide-react'
import { personSchema, type PersonInput } from '@/lib/validations/company'
import { createPerson } from '@/lib/actions/people'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import type { OrganizationOption, ProspectListWithCount } from '@/lib/queries/people'
import type { PipelineStage } from '@/types'

interface PersonFormProps {
  organizations: OrganizationOption[]
  stages: PipelineStage[]
  lists: ProspectListWithCount[]
  // Valeurs lues sur un profil LinkedIn par le bouton « + Filonea »
  initial?: {
    firstName?: string
    lastName?: string
    role?: string
    companyName?: string
    linkedinUrl?: string
    origin?: 'manual' | 'linkedin'
  }
}

const NONE = 'none'
// Dernière liste choisie, reproposée à l'ajout suivant (confort, propre à ce navigateur)
// Clé d'avant le changement de nom (Lynkio), gardée pour ne pas perdre la préférence enregistrée
const LAST_LIST_KEY = 'lynkio-last-person-list'

export function PersonForm({ organizations, stages, lists, initial = {} }: PersonFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  // Personne déjà suivie : lien vers sa fiche
  const [existingId, setExistingId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const defaultStage = stages.find((stage) => stage.is_default) ?? stages[0]

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PersonInput>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      firstName: initial.firstName ?? '',
      lastName: initial.lastName ?? '',
      role: initial.role ?? '',
      linkedinUrl: initial.linkedinUrl ?? '',
      companyMode: initial.companyName ? 'new' : 'none',
      companyName: initial.companyName ?? '',
      isIndependent: false,
      isDecisionMaker: true,
      stageId: defaultStage?.id ?? null,
      listName: '',
      origin: initial.origin ?? 'manual',
    },
  })

  useEffect(() => {
    try {
      const lastList = window.localStorage.getItem(LAST_LIST_KEY)
      if (lastList && lists.some((list) => list.name === lastList)) setValue('listName', lastList)
    } catch {
      // stockage indisponible (navigation privée) : pas de liste proposée
    }
  }, [lists, setValue])

  // Nom tapé : une entreprise déjà suivie (la personne la rejoint), une nouvelle, ou rien (personne seule)
  const companyName = (useWatch({ control, name: 'companyName' }) ?? '').trim()
  const existing = companyName
    ? organizations.find((organization) => organization.name.toLowerCase() === companyName.toLowerCase())
    : undefined

  const onSubmit = async (data: PersonInput) => {
    setError(null)
    setExistingId(null)
    setIsLoading(true)
    let result: Awaited<ReturnType<typeof createPerson>>
    try {
      result = await createPerson(data)
    } catch {
      setError(CONNECTION_ERROR)
      return
    } finally {
      setIsLoading(false)
    }

    if (!result.success || !result.data) {
      setError(result.error || 'Une erreur est survenue')
      if (result.data?.companyId) setExistingId(result.data.companyId)
      return
    }

    try {
      if (data.listName) window.localStorage.setItem(LAST_LIST_KEY, data.listName)
      else window.localStorage.removeItem(LAST_LIST_KEY)
    } catch {
      // stockage indisponible : rien à retenir
    }

    toast({
      title: 'Personne ajoutée',
      description: [data.firstName, data.lastName].filter(Boolean).join(' '),
    })
    router.push(`/companies/${result.data.companyId}`)
    router.refresh()
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-8 pt-6">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
              {existingId && (
                <>
                  {' '}
                  <Link href={`/companies/${existingId}`} className="underline font-medium">
                    Voir sa fiche
                  </Link>
                </>
              )}
            </div>
          )}

          {initial.origin === 'linkedin' && (
            <div className="p-3 text-sm rounded-md bg-primary/10">
              Pré-remplie depuis LinkedIn : vérifiez le prénom, le nom, le poste et l&apos;entreprise avant
              d&apos;ajouter la personne.
            </div>
          )}

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">La personne</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom</Label>
                <Input id="firstName" placeholder="Camille" disabled={isLoading} {...register('firstName')} />
                {errors.firstName && <p className="text-sm text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" placeholder="Martin" disabled={isLoading} {...register('lastName')} />
                {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Poste</Label>
              <Input id="role" placeholder="Gérante, fondateur, développeur indépendant..." disabled={isLoading} {...register('role')} />
              {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedinUrl">Profil LinkedIn</Label>
              <Input
                id="linkedinUrl"
                placeholder="https://www.linkedin.com/in/camille-martin"
                disabled={isLoading}
                {...register('linkedinUrl')}
              />
              {errors.linkedinUrl && <p className="text-sm text-destructive">{errors.linkedinUrl.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" placeholder="camille@exemple.fr" disabled={isLoading} {...register('email')} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" type="tel" placeholder="06 12 34 56 78" disabled={isLoading} {...register('phone')} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Son entreprise</h2>

            <div className="space-y-2">
              <Label htmlFor="companyName">Entreprise</Label>
              <Input
                id="companyName"
                list="organization-options"
                autoComplete="off"
                placeholder="Laisser vide si elle est seule"
                disabled={isLoading}
                {...register('companyName', {
                  onChange: (event) => setValue('companyMode', event.target.value.trim() ? 'new' : 'none'),
                })}
              />
              <datalist id="organization-options">
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.name}>
                    {organization.city ?? ''}
                  </option>
                ))}
              </datalist>
              {errors.companyName && <p className="text-sm text-destructive">{errors.companyName.message}</p>}
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {existing ? (
                  <>
                    <Building2 className="w-4 h-4 shrink-0" />
                    Entreprise déjà suivie{existing.city ? ` (${existing.city})` : ''} : la personne rejoint sa fiche.
                  </>
                ) : companyName ? (
                  <>
                    <Building2 className="w-4 h-4 shrink-0" />
                    Nouvelle entreprise : sa fiche sera créée avec la personne.
                  </>
                ) : (
                  <>
                    <User className="w-4 h-4 shrink-0" />
                    Personne seule : elle aura sa propre fiche. Vous pourrez la rattacher à une entreprise plus tard.
                  </>
                )}
              </p>
            </div>

            {companyName ? (
              <Controller
                name="isDecisionMaker"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isDecisionMaker"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      disabled={isLoading}
                    />
                    <Label htmlFor="isDecisionMaker" className="font-normal">
                      Décideur (peut signer une mission)
                    </Label>
                  </div>
                )}
              />
            ) : (
              <Controller
                name="isIndependent"
                control={control}
                render={({ field }) => (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="isIndependent"
                      checked={field.value ?? false}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      disabled={isLoading}
                    />
                    <Label htmlFor="isIndependent" className="font-normal">
                      Travaille à son compte (indépendant)
                    </Label>
                  </div>
                )}
              />
            )}
          </section>

          {/* Une entreprise déjà suivie garde son propre suivi : ces champs ne servent qu'à une nouvelle fiche */}
          {!existing && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Suivi</h2>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-4">
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
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextAction">Prochaine action</Label>
                <Input
                  id="nextAction"
                  placeholder="Relancer sur LinkedIn, envoyer le devis..."
                  disabled={isLoading}
                  {...register('nextAction')}
                />
                {errors.nextAction && <p className="text-sm text-destructive">{errors.nextAction.message}</p>}
              </div>
            </section>
          )}

          <div className="space-y-2">
            <Label htmlFor="listName" className="flex items-center gap-2">
              <ListPlus className="w-4 h-4" />
              Ranger dans une liste (facultatif)
            </Label>
            <Input
              id="listName"
              list="person-list-options"
              autoComplete="off"
              placeholder="Une liste existante, ou le nom d'une nouvelle"
              maxLength={100}
              disabled={isLoading}
              {...register('listName')}
            />
            <datalist id="person-list-options">
              {lists.map((list) => (
                <option key={list.id} value={list.name} />
              ))}
            </datalist>
            {errors.listName && <p className="text-sm text-destructive">{errors.listName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes sur la personne</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Comment vous l'avez connue, ce qu'elle cherche..."
              disabled={isLoading}
              {...register('notes')}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : 'Ajouter la personne'}
          </Button>
          <Button type="button" variant="outline" disabled={isLoading} onClick={() => router.back()}>
            Annuler
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
