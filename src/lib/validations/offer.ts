import { z } from 'zod'

/**
 * « Mon offre et mes objectifs » : propres à chaque utilisateur, rangés dans le client idéal
 * (icp_profiles.criteria : services, mission_mode, goals). Rien n'est imposé : prestations écrites
 * librement, objectifs proposés par défaut puis modifiables.
 */

export const SERVICE_UNITS = [
  { value: 'project', label: 'par projet' },
  { value: 'day', label: 'par jour' },
  { value: 'month', label: 'par mois' },
  { value: 'hour', label: 'de l’heure' },
] as const

export const MISSION_MODES = [
  { value: 'remote', label: 'À distance', hint: 'Sophie peut chercher dans toute la France' },
  { value: 'onsite', label: 'Sur place', hint: 'Sophie reste près de chez vous' },
  { value: 'both', label: 'Les deux', hint: 'À distance, et sur place quand c’est proche' },
] as const

export const MAX_SERVICES = 15

// Valeurs proposées au départ (modifiables) : un rythme tenable pour une personne seule
export const SUGGESTED_GOALS = { contactsPerWeek: 15, clientsPerMonth: 2 } as const

const optionalNumber = (max: number, message: string) =>
  z
    .number({ invalid_type_error: 'Indiquez un nombre' })
    .int('Un nombre entier')
    .min(0, 'Pas de nombre négatif')
    .max(max, message)
    .nullable()

export const offerSchema = z.object({
  services: z
    .array(
      z.object({
        name: z.string().trim().min(2, 'Nom trop court').max(80, '80 caractères au plus'),
        description: z.string().trim().max(200, '200 caractères au plus').default(''),
        priceFrom: optionalNumber(1_000_000, 'Montant trop élevé'),
        unit: z.enum(['project', 'day', 'month', 'hour']).default('project'),
      })
    )
    .max(MAX_SERVICES, `${MAX_SERVICES} prestations au plus`),
  missionMode: z.enum(['remote', 'onsite', 'both']).nullable(),
  // Sur place : distance maximale acceptée depuis chez soi
  maxDistanceKm: optionalNumber(1000, '1 000 km au plus'),
  goals: z.object({
    contactsPerWeek: optionalNumber(500, '500 au plus'),
    clientsPerMonth: optionalNumber(100, '100 au plus'),
    revenuePerMonth: optionalNumber(1_000_000, 'Montant trop élevé'),
  }),
})

export type OfferInput = z.input<typeof offerSchema>
export type Offer = z.output<typeof offerSchema>

/** Lecture depuis icp_profiles.criteria (JSON libre) : on ne garde que des valeurs valides */
export function readOffer(criteria: unknown): Offer {
  const value = (criteria && typeof criteria === 'object' ? criteria : {}) as Record<string, unknown>
  const goals = (value.goals && typeof value.goals === 'object' ? value.goals : {}) as Record<string, unknown>
  const mission = (value.mission_mode && typeof value.mission_mode === 'object' ? value.mission_mode : {}) as Record<
    string,
    unknown
  >
  const number = (input: unknown) => (typeof input === 'number' && Number.isFinite(input) ? Math.round(input) : null)
  const parsed = offerSchema.safeParse({
    services: Array.isArray(value.services)
      ? value.services
          .filter((service): service is Record<string, unknown> => !!service && typeof service === 'object')
          .map((service) => ({
            name: typeof service.name === 'string' ? service.name : '',
            description: typeof service.description === 'string' ? service.description : '',
            priceFrom: number(service.price_from),
            unit: typeof service.unit === 'string' ? service.unit : 'project',
          }))
      : [],
    missionMode: typeof mission.mode === 'string' ? mission.mode : null,
    maxDistanceKm: number(mission.max_km),
    goals: {
      contactsPerWeek: number(goals.contacts_per_week),
      clientsPerMonth: number(goals.clients_per_month),
      revenuePerMonth: number(goals.revenue_per_month),
    },
  })
  return parsed.success
    ? parsed.data
    : { services: [], missionMode: null, maxDistanceKm: null, goals: { contactsPerWeek: null, clientsPerMonth: null, revenuePerMonth: null } }
}
