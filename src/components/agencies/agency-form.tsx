'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  createAgencySchema,
  sizeRanges,
  signalTypes,
  preferredChannels,
  type CreateAgencyInput,
} from '@/lib/validations/agency'
import { createAgency, updateAgency } from '@/lib/actions/agencies'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/lib/hooks/use-toast'
import type { AgencyWithRelations, AgencyStatus, AgencySource } from '@/types'
import { Loader2, Search, UserSearch } from 'lucide-react'
import { LinkedinIcon } from '@/components/ui/linkedin-icon'

type ContactCandidate = {
  name: string | null
  position: string | null
  email: string
  linkedinUrl: string | null
  confidence: number | null
  seniority: string | null
  isTargetRole: boolean
}

interface AgencyFormProps {
  agency?: AgencyWithRelations
  statuses: AgencyStatus[]
  sources: AgencySource[]
  onSuccess?: () => void
}

const sizeRangeLabels: Record<(typeof sizeRanges)[number], string> = {
  '1-5': '1 à 5 personnes',
  '6-15': '6 à 15 personnes',
  '16-50': '16 à 50 personnes',
  '50+': 'Plus de 50 personnes',
}

const signalTypeLabels: Record<(typeof signalTypes)[number], string> = {
  job_posting_dev: 'Offre d\'emploi dev',
  nextjs_portfolio: 'Réalisation Next.js',
  ai_offer: 'Offre IA',
  other: 'Autre',
}

const preferredChannelLabels: Record<(typeof preferredChannels)[number], string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  phone: 'Téléphone',
  other: 'Autre',
}

export function AgencyForm({ agency, statuses, sources, onSuccess }: AgencyFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isFindingContact, setIsFindingContact] = useState(false)
  const [contactCandidates, setContactCandidates] = useState<ContactCandidate[] | null>(null)
  const [searchFirstName, setSearchFirstName] = useState('')
  const [searchLastName, setSearchLastName] = useState('')

  const isEditing = !!agency

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
  } = useForm<CreateAgencyInput>({
    resolver: zodResolver(createAgencySchema),
    defaultValues: agency
      ? {
          name: agency.name,
          website: agency.website ?? '',
          city: agency.city ?? '',
          sizeRange: agency.size_range ?? undefined,
          signalType: agency.signal_type ?? undefined,
          signalUrl: agency.signal_url ?? '',
          contactName: agency.contact_name ?? '',
          contactRole: agency.contact_role ?? '',
          contactEmail: agency.contact_email ?? '',
          contactPhone: agency.contact_phone ?? '',
          contactLinkedinUrl: agency.contact_linkedin_url ?? '',
          preferredChannel: agency.preferred_channel ?? undefined,
          statusId: agency.status_id ?? undefined,
          sourceId: agency.source_id ?? undefined,
          notes: agency.notes ?? '',
          detectedStack: agency.detected_stack ?? [],
        }
      : {
          detectedStack: [],
        },
  })

  const selectedStatusId = watch('statusId')
  const selectedSourceId = watch('sourceId')
  const selectedSizeRange = watch('sizeRange')
  const selectedSignalType = watch('signalType')
  const selectedPreferredChannel = watch('preferredChannel')
  const detectedStack = watch('detectedStack') || []

  // Définir le statut par défaut au chargement
  useEffect(() => {
    if (!isEditing && statuses.length > 0 && !selectedStatusId) {
      const defaultStatus = statuses.find((s) => s.is_default) || statuses[0]
      if (defaultStatus) {
        setValue('statusId', defaultStatus.id)
      }
    }
  }, [statuses, setValue, isEditing, selectedStatusId])

  const handleAnalyzeWebsite = async () => {
    const website = getValues('website')

    if (!website) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Renseignez d\'abord un site web à analyser',
      })
      return
    }

    setIsAnalyzing(true)

    try {
      const url = website.startsWith('http') ? website : `https://${website}`
      const response = await fetch('/api/agencies/detect-stack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: result.error || 'Impossible d\'analyser le site',
        })
        return
      }

      setValue('detectedStack', result.detected || [])
      toast({
        title: 'Analyse terminée',
        description:
          result.detected && result.detected.length > 0
            ? `Technologies détectées : ${result.detected.join(', ')}`
            : 'Aucune technologie reconnue détectée',
      })
    } catch (err) {
      console.error('Analyze website error:', err)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d\'analyser le site',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleFindContact = async () => {
    const website = getValues('website')

    if (!website) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Renseignez d\'abord un site web pour chercher un contact',
      })
      return
    }

    setIsFindingContact(true)
    setContactCandidates(null)

    const isTargetedSearch = !!(searchFirstName.trim() && searchLastName.trim())

    try {
      const response = await fetch('/api/agencies/find-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website,
          firstName: searchFirstName.trim() || undefined,
          lastName: searchLastName.trim() || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: result.error || 'Impossible de trouver un contact',
        })
        return
      }

      setContactCandidates(result.candidates || [])

      if (!result.candidates || result.candidates.length === 0) {
        toast({
          title: 'Aucun résultat',
          description: isTargetedSearch
            ? 'Hunter.io n\'a pas trouvé d\'email public pour cette personne'
            : 'Hunter.io n\'a trouvé aucun contact pour ce domaine',
        })
      }
    } catch (err) {
      console.error('Find contact error:', err)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de contacter le service d\'enrichissement',
      })
    } finally {
      setIsFindingContact(false)
    }
  }

  const applyCandidate = (candidate: ContactCandidate) => {
    if (candidate.name) setValue('contactName', candidate.name)
    if (candidate.position) setValue('contactRole', candidate.position)
    setValue('contactEmail', candidate.email)
    if (candidate.linkedinUrl) {
      setValue('contactLinkedinUrl', candidate.linkedinUrl)
      setValue('preferredChannel', 'linkedin')
    }
    setContactCandidates(null)
    toast({
      title: 'Contact appliqué',
      description: `Les champs ont été pré-remplis avec ${candidate.name || candidate.email}. Vérifiez avant d'enregistrer.`,
    })
  }

  const onSubmit = async (data: CreateAgencyInput) => {
    setError(null)
    setIsLoading(true)

    try {
      let result

      if (isEditing) {
        result = await updateAgency(agency.id, data)
      } else {
        result = await createAgency(data)
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
          description: isEditing ? 'Agence mise à jour avec succès' : 'Agence créée avec succès',
        })

        if (onSuccess) {
          onSuccess()
        } else {
          router.push('/agencies')
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
        <CardTitle>{isEditing ? 'Modifier l\'agence' : 'Nouvelle agence'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-6">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}

          {/* Identité */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Identité</h3>

            <div className="space-y-2">
              <Label htmlFor="name">
                Nom de l&apos;agence <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Agence Web Studio"
                disabled={isLoading}
                {...register('name')}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Site web</Label>
              <div className="flex gap-2">
                <Input
                  id="website"
                  placeholder="https://agence-exemple.com"
                  disabled={isLoading}
                  {...register('website')}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAnalyzeWebsite}
                  disabled={isLoading || isAnalyzing}
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Analyser le site</span>
                </Button>
              </div>
              {errors.website && (
                <p className="text-sm text-destructive">{errors.website.message}</p>
              )}
              {detectedStack.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {detectedStack.map((tech) => (
                    <Badge key={tech} variant="secondary">
                      {tech}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label htmlFor="sizeRange">Taille de l&apos;agence</Label>
                <Select
                  value={selectedSizeRange ?? undefined}
                  onValueChange={(value) => setValue('sizeRange', value as never)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="sizeRange">
                    <SelectValue placeholder="Sélectionner une fourchette" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizeRanges.map((range) => (
                      <SelectItem key={range} value={range}>
                        {sizeRangeLabels[range]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Signal */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Signal d&apos;opportunité</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signalType">Type de signal</Label>
                <Select
                  value={selectedSignalType ?? undefined}
                  onValueChange={(value) => setValue('signalType', value as never)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="signalType">
                    <SelectValue placeholder="Sélectionner un signal" />
                  </SelectTrigger>
                  <SelectContent>
                    {signalTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {signalTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signalUrl">URL du signal</Label>
                <Input
                  id="signalUrl"
                  placeholder="https://..."
                  disabled={isLoading}
                  {...register('signalUrl')}
                />
                {errors.signalUrl && (
                  <p className="text-sm text-destructive">{errors.signalUrl.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact humain */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Contact</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFindContact}
                disabled={isLoading || isFindingContact}
              >
                {isFindingContact ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserSearch className="w-4 h-4" />
                )}
                <span className="ml-2">Trouver un contact</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchFirstName">Chercher une personne précise (optionnel)</Label>
                <Input
                  id="searchFirstName"
                  placeholder="Prénom"
                  value={searchFirstName}
                  onChange={(e) => setSearchFirstName(e.target.value)}
                  disabled={isLoading || isFindingContact}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="searchLastName" className="md:invisible">
                  Nom
                </Label>
                <Input
                  id="searchLastName"
                  placeholder="Nom"
                  value={searchLastName}
                  onChange={(e) => setSearchLastName(e.target.value)}
                  disabled={isLoading || isFindingContact}
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-2 md:col-span-2">
                Laisse vide pour un balayage global du domaine (limité aux 10 premiers
                résultats), ou renseigne un nom pour cibler directement cette personne.
              </p>
            </div>

            {contactCandidates && contactCandidates.length > 0 && (
              <div className="space-y-2 p-3 rounded-md border bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Résultats Hunter.io — les profils CTO / Tech Lead sont mis en avant :
                </p>
                {contactCandidates.map((candidate, index) => (
                  <div
                    key={`${candidate.email}-${index}`}
                    className="flex items-center justify-between gap-3 p-2 rounded-md bg-background border"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {candidate.name || candidate.email}
                        </span>
                        {candidate.isTargetRole && (
                          <Badge variant="default">Poste visé</Badge>
                        )}
                        {candidate.linkedinUrl && (
                          <a
                            href={candidate.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <LinkedinIcon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {candidate.position || 'Poste inconnu'} · {candidate.email}
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
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Nom du contact</Label>
                <Input
                  id="contactName"
                  placeholder="Jean Dupont"
                  disabled={isLoading}
                  {...register('contactName')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactRole">Rôle</Label>
                <Input
                  id="contactRole"
                  placeholder="CTO, Fondateur..."
                  disabled={isLoading}
                  {...register('contactRole')}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="contact@agence-exemple.com"
                  disabled={isLoading}
                  {...register('contactEmail')}
                />
                {errors.contactEmail && (
                  <p className="text-sm text-destructive">{errors.contactEmail.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactPhone">Téléphone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  placeholder="+33 6 12 34 56 78"
                  disabled={isLoading}
                  {...register('contactPhone')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactLinkedinUrl">Profil LinkedIn</Label>
              <Input
                id="contactLinkedinUrl"
                placeholder="https://www.linkedin.com/in/..."
                disabled={isLoading}
                {...register('contactLinkedinUrl')}
              />
              {errors.contactLinkedinUrl && (
                <p className="text-sm text-destructive">{errors.contactLinkedinUrl.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredChannel">Canal préféré</Label>
              <Select
                value={selectedPreferredChannel ?? undefined}
                onValueChange={(value) => setValue('preferredChannel', value as never)}
                disabled={isLoading}
              >
                <SelectTrigger id="preferredChannel">
                  <SelectValue placeholder="Sélectionner un canal" />
                </SelectTrigger>
                <SelectContent>
                  {preferredChannels.map((channel) => (
                    <SelectItem key={channel} value={channel}>
                      {preferredChannelLabels[channel]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              </div>
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
            {isLoading ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer l\'agence'}
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
