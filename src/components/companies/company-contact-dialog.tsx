'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, UserSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'
import { companyContactSchema, type CompanyContactInput } from '@/lib/validations/company'
import { createCompanyContact, updateCompanyContact } from '@/lib/actions/company-contacts'
import { useToast } from '@/lib/hooks/use-toast'
import type { CompanyContact } from '@/types'

// Réponse de /api/companies/find-contact (Hunter.io)
type ContactCandidate = {
  name: string | null
  position: string | null
  email: string
  linkedinUrl: string | null
  confidence: number | null
  isTargetRole: boolean
}

interface CompanyContactDialogProps {
  companyId: string
  website: string | null
  contact?: CompanyContact
  open: boolean
  onOpenChange: (open: boolean) => void
}

function toFormValues(companyId: string, contact?: CompanyContact): CompanyContactInput {
  return {
    companyId,
    firstName: contact?.first_name ?? '',
    lastName: contact?.last_name ?? '',
    role: contact?.role ?? '',
    isDecisionMaker: contact?.is_decision_maker ?? false,
    email: contact?.email ?? '',
    emailSource: contact?.email_source ?? null,
    emailConfidence: contact?.email_confidence ?? null,
    phone: contact?.phone ?? '',
    linkedinUrl: contact?.linkedin_url ?? '',
    notes: contact?.notes ?? '',
  }
}

export function CompanyContactDialog({
  companyId,
  website,
  contact,
  open,
  onOpenChange,
}: CompanyContactDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [candidates, setCandidates] = useState<ContactCandidate[] | null>(null)

  const isEditing = !!contact

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    reset,
  } = useForm<CompanyContactInput>({
    resolver: zodResolver(companyContactSchema),
    defaultValues: toFormValues(companyId, contact),
  })

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      reset(toFormValues(companyId, contact))
      setCandidates(null)
      setError(null)
    }
    onOpenChange(nextOpen)
  }

  // Sans nom : balayage du domaine. Avec prénom et nom : recherche ciblée de cette personne.
  const handleHunterSearch = async () => {
    if (!website) return

    const firstName = getValues('firstName')?.trim()
    const lastName = getValues('lastName')?.trim()

    setIsSearching(true)
    setCandidates(null)

    try {
      const response = await fetch('/api/companies/find-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website,
          firstName: firstName && lastName ? firstName : undefined,
          lastName: firstName && lastName ? lastName : undefined,
        }),
      })
      const result = await response.json()

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Recherche impossible',
          description: result.error || 'Impossible d\'interroger Hunter.io',
        })
        return
      }

      setCandidates(result.candidates ?? [])
    } catch {
      toast({
        variant: 'destructive',
        title: 'Recherche impossible',
        description: 'Impossible de contacter le service de recherche',
      })
    } finally {
      setIsSearching(false)
    }
  }

  const applyCandidate = (candidate: ContactCandidate) => {
    if (candidate.name) {
      const [first, ...rest] = candidate.name.trim().split(/\s+/)
      setValue('firstName', first ?? '')
      setValue('lastName', rest.join(' '))
    }
    if (candidate.position) setValue('role', candidate.position)
    if (candidate.isTargetRole) setValue('isDecisionMaker', true)
    setValue('email', candidate.email)
    setValue('emailSource', 'hunter')
    setValue('emailConfidence', candidate.confidence)
    if (candidate.linkedinUrl) setValue('linkedinUrl', candidate.linkedinUrl)
    setCandidates(null)
  }

  const onSubmit = async (data: CompanyContactInput) => {
    setError(null)
    setIsLoading(true)

    const result = isEditing
      ? await updateCompanyContact(contact.id, data)
      : await createCompanyContact(data)

    setIsLoading(false)

    if (!result.success) {
      setError(result.error || 'Une erreur est survenue')
      return
    }

    toast({ title: isEditing ? 'Contact mis à jour' : 'Contact ajouté' })
    handleOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Modifier le contact' : 'Ajouter un contact'}</DialogTitle>
          <DialogDescription>
            La personne à qui vous écrirez dans cette entreprise.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md" role="alert">
              {error}
            </div>
          )}

          {!isEditing && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <p className="text-sm text-muted-foreground">
                  {website
                    ? 'Chercher un e-mail avec Hunter.io. Remplissez prénom et nom pour viser une personne précise.'
                    : 'Ajoutez le site web de l\'entreprise pour chercher un e-mail avec Hunter.io.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleHunterSearch}
                  disabled={!website || isSearching || isLoading}
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserSearch className="w-4 h-4" />
                  )}
                  <span className="ml-2">Chercher</span>
                </Button>
              </div>

              {candidates && candidates.length === 0 && (
                <p className="text-sm">Aucun e-mail public trouvé.</p>
              )}

              {candidates && candidates.length > 0 && (
                <ul className="space-y-2">
                  {candidates.map((candidate, index) => (
                    <li
                      key={`${candidate.email}-${index}`}
                      className="flex items-center justify-between gap-3 p-2 rounded-md bg-background border"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{candidate.name || candidate.email}</span>
                          {candidate.isTargetRole && <Badge>Poste visé</Badge>}
                          {candidate.linkedinUrl && (
                            <LinkedinIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {candidate.position || 'Poste inconnu'} · {candidate.email}
                          {candidate.confidence !== null && ` · fiabilité ${candidate.confidence} %`}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => applyCandidate(candidate)}
                      >
                        Choisir
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" disabled={isLoading} {...register('firstName')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom</Label>
              <Input id="lastName" disabled={isLoading} {...register('lastName')} />
              {errors.lastName && <p className="text-sm text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Poste</Label>
            <Input
              id="role"
              placeholder="Gérante, directeur technique..."
              disabled={isLoading}
              {...register('role')}
            />
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                disabled={isLoading}
                {...register('email', {
                  // Un e-mail saisi à la main n'a plus de lien avec la recherche Hunter
                  onChange: () => {
                    setValue('emailSource', 'manual')
                    setValue('emailConfidence', null)
                  },
                })}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone</Label>
              <Input id="phone" type="tel" disabled={isLoading} {...register('phone')} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedinUrl">Profil LinkedIn</Label>
            <Input
              id="linkedinUrl"
              placeholder="https://www.linkedin.com/in/..."
              disabled={isLoading}
              {...register('linkedinUrl')}
            />
            {errors.linkedinUrl && (
              <p className="text-sm text-destructive">{errors.linkedinUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactNotes">Notes</Label>
            <Textarea id="contactNotes" rows={3} disabled={isLoading} {...register('notes')} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : isEditing ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
