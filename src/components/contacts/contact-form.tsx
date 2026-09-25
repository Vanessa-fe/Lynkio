'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createContactSchema, type CreateContactInput } from '@/lib/validations/contact'
import { createContact, updateContact } from '@/lib/actions/contacts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/lib/hooks/use-toast'
import type { ContactWithRelations, ContactStatus, ContactSource } from '@/types'

interface ContactFormProps {
  contact?: ContactWithRelations
  statuses: ContactStatus[]
  sources: ContactSource[]
  onSuccess?: () => void
}

export function ContactForm({ contact, statuses, sources, onSuccess }: ContactFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const isEditing = !!contact

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateContactInput>({
    resolver: zodResolver(createContactSchema),
    defaultValues: contact
      ? {
          firstName: contact.first_name ?? '',
          lastName: contact.last_name ?? '',
          nickname: contact.nickname ?? '',
          phone: contact.phone ?? '',
          email: contact.email ?? '',
          age: contact.age ?? undefined,
          city: contact.city ?? '',
          sourceId: contact.source_id ?? undefined,
          statusId: contact.status_id ?? undefined,
          favorite: contact.favorite ?? false,
          riskLevel: contact.risk_level ?? 'normal',
          notes: contact.notes ?? '',
        }
      : {
          favorite: false,
          riskLevel: 'normal',
        },
  })

  const selectedStatusId = watch('statusId')
  const selectedSourceId = watch('sourceId')
  const selectedRiskLevel = watch('riskLevel')

  // Définir le statut par défaut au chargement
  useEffect(() => {
    if (!isEditing && statuses.length > 0 && !selectedStatusId) {
      const defaultStatus = statuses.find((s) => s.is_default) || statuses[0]
      if (defaultStatus) {
        setValue('statusId', defaultStatus.id)
      }
    }
  }, [statuses, setValue, isEditing, selectedStatusId])

  const onSubmit = async (data: CreateContactInput) => {
    setError(null)
    setIsLoading(true)

    try {
      let result

      if (isEditing) {
        result = await updateContact(contact.id, data)
      } else {
        result = await createContact(data)
      }

      if (!result.success) {
        setError(result.error || 'Une erreur est survenue')
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: result.error || 'Une erreur est survenue',
        })
      } else {
        toast({
          title: 'Succès',
          description: isEditing
            ? 'Contact mis à jour avec succès'
            : 'Contact créé avec succès',
        })

        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/contacts')
          router.refresh()
        }
      }
    } catch (err) {
      const errorMessage = 'Une erreur inattendue est survenue'
      setError(errorMessage)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Modifier le contact' : 'Nouveau contact'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {/* Informations de base */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informations de base</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="firstName"
                  placeholder="Jean"
                  disabled={isLoading}
                  {...register('firstName')}
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Nom</Label>
                <Input
                  id="lastName"
                  placeholder="Dupont"
                  disabled={isLoading}
                  {...register('lastName')}
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname">Surnom</Label>
              <Input
                id="nickname"
                placeholder="Jeannot"
                disabled={isLoading}
                {...register('nickname')}
              />
              {errors.nickname && (
                <p className="text-sm text-destructive">{errors.nickname.message}</p>
              )}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Coordonnées</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+33 6 12 34 56 78"
                  disabled={isLoading}
                  {...register('phone')}
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jean.dupont@exemple.com"
                  disabled={isLoading}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="age">Âge</Label>
                <Input
                  id="age"
                  type="number"
                  placeholder="30"
                  disabled={isLoading}
                  {...register('age', { valueAsNumber: true })}
                />
                {errors.age && <p className="text-sm text-destructive">{errors.age.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville</Label>
                <Input
                  id="city"
                  placeholder="Paris"
                  disabled={isLoading}
                  {...register('city')}
                />
                {errors.city && <p className="text-sm text-destructive">{errors.city.message}</p>}
              </div>
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Classification</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="statusId">Statut</Label>
                <Select
                  value={selectedStatusId ?? undefined}
                  onValueChange={(value) => setValue('statusId', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="statusId">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: status.color }}
                          />
                          {status.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.statusId && (
                  <p className="text-sm text-destructive">{errors.statusId.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sourceId">Source</Label>
                <Select
                  value={selectedSourceId ?? undefined}
                  onValueChange={(value) => setValue('sourceId', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="sourceId">
                    <SelectValue placeholder="Sélectionner une source" />
                  </SelectTrigger>
                  <SelectContent>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.sourceId && (
                  <p className="text-sm text-destructive">{errors.sourceId.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskLevel">Niveau de risque</Label>
              <Select
                value={selectedRiskLevel}
                onValueChange={(value) =>
                  setValue('riskLevel', value as 'normal' | 'monitor' | 'insistent' | 'blocked')
                }
                disabled={isLoading}
              >
                <SelectTrigger id="riskLevel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="monitor">À surveiller</SelectItem>
                  <SelectItem value="insistent">Insistant</SelectItem>
                  <SelectItem value="blocked">Bloqué</SelectItem>
                </SelectContent>
              </Select>
              {errors.riskLevel && (
                <p className="text-sm text-destructive">{errors.riskLevel.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              rows={4}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Notes supplémentaires..."
              disabled={isLoading}
              {...register('notes')}
            />
            {errors.notes && <p className="text-sm text-destructive">{errors.notes.message}</p>}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer le contact'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => router.back()}
          >
            Annuler
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
