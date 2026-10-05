import { z } from 'zod'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import type {
  CompanyInteractionStatus,
  CompanyInteractionType,
  SizeCategory,
} from '@/types'

/**
 * Schémas de validation pour les entreprises prospectées et leurs contacts
 */

export const sizeCategories = ['solo', 'tpe', 'pme', 'eti', 'ge'] as const satisfies readonly SizeCategory[]

export const sizeCategoryLabels: Record<SizeCategory, string> = {
  solo: 'Indépendant (0 salarié)',
  tpe: 'TPE (1 à 9 salariés)',
  pme: 'PME (10 à 249 salariés)',
  eti: 'ETI (250 à 4 999 salariés)',
  ge: 'Grande entreprise (5 000 et plus)',
}

// Champ texte optionnel : une chaîne vide est enregistrée comme NULL
const optionalText = (max: number, message: string) =>
  z
    .string()
    .max(max, message)
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null))

const optionalUrl = (message: string) =>
  optionalText(500, message).refine(
    (value) => !value || /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]+$/i.test(value),
    'L\'adresse n\'est pas valide'
  )

export const MAX_ESTIMATED_AMOUNT = 10_000_000

/**
 * Montant saisi librement (« 12 000 », « 12 000 € HT », « 4 500,50 », « 12k ») → euros entiers.
 * Vide : null. Illisible : NaN, que la validation refuse.
 */
export function parseEuroAmount(value: string): number | null {
  const compact = value
    .replace(/[\s  ]/g, '')
    .replace(/€|eur(os?)?|ht/gi, '')
    .replace(',', '.')
  if (!compact) return null
  const thousands = /k$/i.test(compact)
  const amount = Number(thousands ? compact.slice(0, -1) : compact)
  return Number.isFinite(amount) ? Math.round(thousands ? amount * 1000 : amount) : NaN
}

const optionalAmount = z.preprocess(
  (value) => (typeof value === 'string' ? parseEuroAmount(value) : value),
  z
    .number({ invalid_type_error: 'Le montant n\'est pas valide' })
    .int()
    .min(0, 'Le montant ne peut pas être négatif')
    .max(MAX_ESTIMATED_AMOUNT, 'Le montant est trop élevé')
    .nullable()
    .optional()
)

/**
 * Schéma de création d'une entreprise
 */
export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(200, 'Le nom est trop long'),
  website: optionalUrl('L\'URL est trop longue'),
  // SIREN : 9 chiffres (les espaces saisis sont retirés)
  registrationId: z
    .string()
    .optional()
    .nullable()
    .transform((value) => (value ? value.replace(/\s/g, '') : null))
    .refine((value) => !value || /^\d{9}$/.test(value), 'Le SIREN doit contenir 9 chiffres'),
  sector: optionalText(200, 'Le secteur est trop long'),
  sizeCategory: z
    .enum(sizeCategories, {
      errorMap: () => ({ message: 'La taille n\'est pas valide' }),
    })
    .optional()
    .nullable(),
  city: optionalText(100, 'La ville est trop longue'),
  postalCode: optionalText(10, 'Le code postal est trop long'),
  stageId: z.string().uuid('L\'étape n\'est pas valide').optional().nullable(),
  sourceId: z.string().uuid('La source n\'est pas valide').optional().nullable(),
  notes: optionalText(5000, 'Les notes sont trop longues'),
  estimatedAmount: optionalAmount,
  nextAction: optionalText(300, 'La prochaine action est trop longue'),
  detectedStack: z.array(z.string()).optional(),
})

export const updateCompanySchema = createCompanySchema.partial()

export type CreateCompanyInput = z.input<typeof createCompanySchema>
export type UpdateCompanyInput = z.input<typeof updateCompanySchema>

/**
 * Domaine d'un site web, calculé comme la colonne générée companies.website_domain
 * (même règle, pour retrouver un doublon avant que la contrainte d'unicité ne refuse l'insertion)
 */
export function toWebsiteDomain(website: string | null | undefined): string | null {
  if (!website) return null

  const domain = website
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/i, '')
    .replace(/[/:?#].*$/, '')
    .toLowerCase()

  return domain || null
}

/**
 * Adresse cliquable à partir d'un site saisi avec ou sans protocole
 */
export function toWebsiteUrl(website: string): string {
  return website.startsWith('http') ? website : `https://${website}`
}

/**
 * Contacts d'une entreprise
 */
export const companyContactSchema = z
  .object({
    companyId: z.string().uuid('L\'entreprise n\'est pas valide'),
    firstName: optionalText(100, 'Le prénom est trop long'),
    lastName: optionalText(100, 'Le nom est trop long'),
    role: optionalText(200, 'Le poste est trop long'),
    isDecisionMaker: z.boolean().default(false),
    email: z
      .string()
      .trim()
      .max(255, 'L\'e-mail est trop long')
      .optional()
      .nullable()
      .transform((value) => (value ? value.toLowerCase() : null))
      .refine((value) => !value || z.string().email().safeParse(value).success, 'L\'e-mail n\'est pas valide'),
    emailSource: z.enum(['manual', 'hunter', 'website', 'other']).optional().nullable(),
    emailConfidence: z.number().int().min(0).max(100).optional().nullable(),
    phone: z
      .string()
      .optional()
      .nullable()
      .transform((value) => {
        if (!value || value.trim() === '') return null
        // France par défaut : « 06 12 34 56 78 » devient « +33612345678 »
        return parsePhoneNumberFromString(value, 'FR')?.format('E.164') ?? value.trim()
      }),
    linkedinUrl: optionalUrl('L\'URL LinkedIn est trop longue'),
    notes: optionalText(2000, 'Les notes sont trop longues'),
  })
  .refine((data) => data.firstName || data.lastName || data.email || data.linkedinUrl, {
    message: 'Renseignez au moins un nom, un e-mail ou un profil LinkedIn',
    path: ['lastName'],
  })

export type CompanyContactInput = z.input<typeof companyContactSchema>

export function contactDisplayName(contact: {
  first_name: string | null
  last_name: string | null
  email?: string | null
}): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ')
  return name || contact.email || 'Contact sans nom'
}

/**
 * Échanges avec une entreprise
 */
export const companyInteractionTypes = [
  'email',
  'linkedin_message',
  'call',
  'meeting',
  'note',
] as const satisfies readonly CompanyInteractionType[]

export const companyInteractionTypeLabels: Record<CompanyInteractionType, string> = {
  email: 'E-mail',
  linkedin_message: 'Message LinkedIn',
  call: 'Appel',
  meeting: 'Rendez-vous',
  note: 'Note',
  system_event: 'Événement',
}

export const companyInteractionStatuses = [
  'done',
  'scheduled',
  'draft',
] as const satisfies readonly CompanyInteractionStatus[]

export const companyInteractionStatusLabels: Record<CompanyInteractionStatus, string> = {
  done: 'Effectué',
  scheduled: 'Prévu',
  draft: 'Brouillon',
}

export const companyInteractionSchema = z
  .object({
    companyId: z.string().uuid('L\'entreprise n\'est pas valide'),
    contactId: z.string().uuid('Le contact n\'est pas valide').optional().nullable(),
    type: z.enum(companyInteractionTypes, {
      errorMap: () => ({ message: 'Choisissez un type d\'échange' }),
    }),
    status: z.enum(companyInteractionStatuses).default('done'),
    direction: z.enum(['incoming', 'outgoing']).optional().nullable(),
    subject: optionalText(300, 'L\'objet est trop long'),
    content: optionalText(10000, 'Le contenu est trop long'),
    occurredAt: z.coerce.date({
      errorMap: () => ({ message: 'La date n\'est pas valide' }),
    }),
  })
  .refine((data) => data.type !== 'note' || !!data.content, {
    message: 'Le contenu est requis pour une note',
    path: ['content'],
  })

export type CompanyInteractionInput = z.input<typeof companyInteractionSchema>

/**
 * Numéro enregistré en E.164 (+33612345678), affiché au format lisible (06 12 34 56 78)
 */
export function formatPhoneForDisplay(phone: string): string {
  const parsed = parsePhoneNumberFromString(phone, 'FR')
  if (!parsed) return phone
  return parsed.country === 'FR' ? parsed.formatNational() : parsed.formatInternational()
}

/**
 * Ancienneté d'une entreprise à partir de sa date de création (AAAA-MM-JJ) :
 * une information pour juger du budget probable, pas un critère de sélection
 */
export function companyAge(foundedOn: string | null): { since: string; age: string } | null {
  if (!foundedOn) return null
  const founded = new Date(`${foundedOn}T00:00:00`)
  if (Number.isNaN(founded.getTime())) return null

  const now = new Date()
  let years = now.getFullYear() - founded.getFullYear()
  const anniversaryPassed =
    now.getMonth() > founded.getMonth() ||
    (now.getMonth() === founded.getMonth() && now.getDate() >= founded.getDate())
  if (!anniversaryPassed) years--

  return {
    since: founded.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    age: years < 1 ? 'moins d\'un an' : `${years} an${years > 1 ? 's' : ''}`,
  }
}

/**
 * « 1,2 M€ », « 350 k€ », « 600 € » : montant lisible d'un coup d'œil
 */
export function formatEuros(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1_000_000) return `${(amount / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M€`
  if (abs >= 10_000) return `${Math.round(amount / 1000).toLocaleString('fr-FR')} k€`
  return `${Math.round(amount).toLocaleString('fr-FR')} €`
}

/**
 * Adresse d'un profil LinkedIn de personne, au format attendu par Waalaxy
 * (https://www.linkedin.com/in/identifiant/), ou null si ce n'en est pas une
 * (page entreprise, recherche, publication…)
 */
export function normalizeLinkedinProfileUrl(value: string | null | undefined): string | null {
  const match = value
    ?.trim()
    .match(/^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)\/?/i)
  if (!match?.[1]) return null
  return `https://www.linkedin.com/in/${decodeURIComponent(match[1]).replace(/\s+/g, '')}/`
}

/**
 * Recherche LinkedIn de la personne : son nom et son entreprise
 */
export function linkedinPeopleSearchUrl(contact: { first_name: string | null; last_name: string | null }, companyName: string) {
  const keywords = [contact.first_name, contact.last_name, companyName].filter(Boolean).join(' ')
  return `https://www.linkedin.com/search/results/people/?${new URLSearchParams({ keywords })}`
}
