'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { saveOffer } from '@/lib/actions/offer'
import { CONNECTION_ERROR } from '@/lib/constants/errors'
import { useToast } from '@/lib/hooks/use-toast'
import { cn } from '@/lib/utils/cn'
import { MAX_SERVICES, MISSION_MODES, SERVICE_UNITS, SUGGESTED_GOALS, type Offer } from '@/lib/validations/offer'

type ServiceRow = { name: string; description: string; priceFrom: string; unit: Offer['services'][number]['unit'] }

const toNumber = (value: string): number | null => {
  const cleaned = value.replace(/\s/g, '').replace(',', '.')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? Math.round(parsed) : NaN
}

/**
 * « Mon offre et mes objectifs » : prestations écrites par l'utilisateur, mode de mission, objectifs
 * (proposés par défaut, modifiables). Tout est propre à chaque compte.
 */
export function OfferForm({ offer, dayRate }: { offer: Offer; dayRate: number | null }) {
  const router = useRouter()
  const { toast } = useToast()
  const [services, setServices] = useState<ServiceRow[]>(
    offer.services.map((service) => ({
      name: service.name,
      description: service.description,
      priceFrom: service.priceFrom?.toString() ?? '',
      unit: service.unit,
    }))
  )
  const [missionMode, setMissionMode] = useState<Offer['missionMode']>(offer.missionMode)
  const [maxDistance, setMaxDistance] = useState(offer.maxDistanceKm?.toString() ?? '')
  const [contactsPerWeek, setContactsPerWeek] = useState(offer.goals.contactsPerWeek?.toString() ?? '')
  const [clientsPerMonth, setClientsPerMonth] = useState(offer.goals.clientsPerMonth?.toString() ?? '')
  const [revenuePerMonth, setRevenuePerMonth] = useState(offer.goals.revenuePerMonth?.toString() ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Chiffre d'affaires proposé : une dizaine de jours facturés par mois au tarif du client idéal
  const suggestedRevenue = dayRate ? dayRate * 10 : null

  const updateService = (index: number, patch: Partial<ServiceRow>) =>
    setServices((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  const applySuggestions = () => {
    if (!contactsPerWeek) setContactsPerWeek(String(SUGGESTED_GOALS.contactsPerWeek))
    if (!clientsPerMonth) setClientsPerMonth(String(SUGGESTED_GOALS.clientsPerMonth))
    if (!revenuePerMonth && suggestedRevenue) setRevenuePerMonth(String(suggestedRevenue))
  }

  const save = async () => {
    setError(null)
    const numbers = {
      maxDistance: toNumber(maxDistance),
      contacts: toNumber(contactsPerWeek),
      clients: toNumber(clientsPerMonth),
      revenue: toNumber(revenuePerMonth),
      prices: services.map((service) => toNumber(service.priceFrom)),
    }
    if ([numbers.maxDistance, numbers.contacts, numbers.clients, numbers.revenue, ...numbers.prices].some(Number.isNaN)) {
      setError('Un des nombres n’est pas valide : écrivez seulement des chiffres')
      return
    }
    setIsSaving(true)
    try {
      const result = await saveOffer({
        services: services
          .filter((service) => service.name.trim())
          .map((service, index) => ({
            name: service.name,
            description: service.description,
            priceFrom: numbers.prices[index] ?? null,
            unit: service.unit,
          })),
        missionMode,
        maxDistanceKm: numbers.maxDistance,
        goals: { contactsPerWeek: numbers.contacts, clientsPerMonth: numbers.clients, revenuePerMonth: numbers.revenue },
      })
      if (!result.success) {
        setError(result.error ?? 'Impossible d’enregistrer')
        return
      }
      toast({ title: 'Offre et objectifs enregistrés' })
      router.refresh()
    } catch {
      setError(CONNECTION_ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Vos prestations</CardTitle>
          <CardDescription>
            Ce que vous proposez, avec vos mots. Sophie s’en servira pour choisir la bonne prestation selon
            l’entreprise. Le prix est facultatif et reste privé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {services.length === 0 && (
            <p className="text-sm text-muted-foreground">Aucune prestation pour l’instant.</p>
          )}
          {services.map((service, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  aria-label={`Nom de la prestation ${index + 1}`}
                  placeholder="Ex. : site vitrine, accompagnement mensuel…"
                  value={service.name}
                  maxLength={80}
                  onChange={(event) => updateService(index, { name: event.target.value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Supprimer la prestation ${service.name || index + 1}`}
                  onClick={() => setServices((rows) => rows.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <Input
                aria-label={`Description de la prestation ${index + 1}`}
                placeholder="En une phrase (facultatif)"
                value={service.description}
                maxLength={200}
                onChange={(event) => updateService(index, { description: event.target.value })}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  aria-label={`Prix à partir de, prestation ${index + 1}`}
                  inputMode="numeric"
                  placeholder="À partir de … € (facultatif)"
                  value={service.priceFrom}
                  onChange={(event) => updateService(index, { priceFrom: event.target.value })}
                />
                <Select value={service.unit} onValueChange={(value) => updateService(index, { unit: value as ServiceRow['unit'] })}>
                  <SelectTrigger aria-label={`Unité du prix, prestation ${index + 1}`}>
                    <SelectValue>{SERVICE_UNITS.find((unit) => unit.value === service.unit)?.label}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SERVICE_UNITS.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={services.length >= MAX_SERVICES}
            onClick={() => setServices((rows) => [...rows, { name: '', description: '', priceFrom: '', unit: 'project' }])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter une prestation
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comment vous travaillez</CardTitle>
          <CardDescription>À distance, sur place, ou les deux.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Mode de mission">
            {MISSION_MODES.map((mode) => (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={missionMode === mode.value}
                onClick={() => setMissionMode(mode.value)}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  missionMode === mode.value ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                )}
              >
                <span className="font-medium">{mode.label}</span>
                <span className="mt-1 block text-muted-foreground">{mode.hint}</span>
              </button>
            ))}
          </div>
          {(missionMode === 'onsite' || missionMode === 'both') && (
            <div className="space-y-2 sm:max-w-xs">
              <Label htmlFor="offer-distance">Jusqu’à combien de kilomètres de chez vous ?</Label>
              <Input
                id="offer-distance"
                inputMode="numeric"
                placeholder="Ex. : 50"
                value={maxDistance}
                onChange={(event) => setMaxDistance(event.target.value)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Vos objectifs</CardTitle>
              <CardDescription className="mt-1.5">
                Ce que vous visez. Le tableau de bord vous montre où vous en êtes. Laissez vide ce qui ne vous parle pas.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={applySuggestions} className="shrink-0">
              <Wand2 className="mr-2 h-4 w-4" />
              Proposer des objectifs
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="goal-contacts">Prises de contact par semaine</Label>
            <Input
              id="goal-contacts"
              inputMode="numeric"
              placeholder={`Suggestion : ${SUGGESTED_GOALS.contactsPerWeek}`}
              value={contactsPerWeek}
              onChange={(event) => setContactsPerWeek(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-clients">Nouveaux clients par mois</Label>
            <Input
              id="goal-clients"
              inputMode="numeric"
              placeholder={`Suggestion : ${SUGGESTED_GOALS.clientsPerMonth}`}
              value={clientsPerMonth}
              onChange={(event) => setClientsPerMonth(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal-revenue">Chiffre d’affaires signé par mois (€)</Label>
            <Input
              id="goal-revenue"
              inputMode="numeric"
              placeholder={suggestedRevenue ? `Suggestion : ${suggestedRevenue}` : 'Facultatif'}
              value={revenuePerMonth}
              onChange={(event) => setRevenuePerMonth(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="button" onClick={save} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </div>
  )
}
