import { z } from 'zod'
import type { SizeCategory } from '@/types'
import { MAX_ESTIMATED_AMOUNT, parseEuroAmount } from './company'

/**
 * Import et export CSV des entreprises. Les colonnes de l'export sont
 * reconnues à l'import : un fichier exporté peut être réimporté tel quel.
 */

export const MAX_IMPORT_ROWS = 1000

export type ImportField =
  | 'name'
  | 'website'
  | 'registrationId'
  | 'city'
  | 'postalCode'
  | 'sector'
  | 'sizeCategory'
  | 'notes'
  | 'source'
  | 'estimatedAmount'
  | 'nextAction'
  | 'contactFirstName'
  | 'contactLastName'
  | 'contactRole'
  | 'contactEmail'
  | 'contactPhone'
  | 'contactLinkedin'

// Libellés des colonnes de l'export (et du modèle), reconnus à l'import
export const COLUMN_LABELS: Record<ImportField, string> = {
  name: 'Nom',
  website: 'Site web',
  registrationId: 'SIREN',
  city: 'Ville',
  postalCode: 'Code postal',
  sector: 'Secteur',
  sizeCategory: 'Taille',
  notes: 'Notes',
  source: 'Source',
  estimatedAmount: 'Montant estimé HT',
  nextAction: 'Prochaine action',
  contactFirstName: 'Contact prénom',
  contactLastName: 'Contact nom',
  contactRole: 'Contact poste',
  contactEmail: 'Contact e-mail',
  contactPhone: 'Contact téléphone',
  contactLinkedin: 'Contact LinkedIn',
}

// Autres intitulés courants, déjà normalisés (sans accents, minuscules, ponctuation retirée)
const HEADER_ALIASES: Record<string, ImportField> = {
  nom: 'name',
  entreprise: 'name',
  societe: 'name',
  'nom entreprise': 'name',
  'raison sociale': 'name',
  company: 'name',
  'company name': 'name',
  name: 'name',
  site: 'website',
  'site web': 'website',
  'site internet': 'website',
  siteweb: 'website',
  website: 'website',
  url: 'website',
  domaine: 'website',
  siren: 'registrationId',
  siret: 'registrationId',
  ville: 'city',
  commune: 'city',
  city: 'city',
  'code postal': 'postalCode',
  cp: 'postalCode',
  codepostal: 'postalCode',
  'postal code': 'postalCode',
  zip: 'postalCode',
  secteur: 'sector',
  'secteur d activite': 'sector',
  activite: 'sector',
  industry: 'sector',
  sector: 'sector',
  taille: 'sizeCategory',
  effectif: 'sizeCategory',
  size: 'sizeCategory',
  notes: 'notes',
  note: 'notes',
  commentaire: 'notes',
  commentaires: 'notes',
  source: 'source',
  origine: 'source',
  montant: 'estimatedAmount',
  'montant estime': 'estimatedAmount',
  'montant ht': 'estimatedAmount',
  budget: 'estimatedAmount',
  'budget ht': 'estimatedAmount',
  'prochaine action': 'nextAction',
  'next action': 'nextAction',
  'next step': 'nextAction',
  'contact prenom': 'contactFirstName',
  prenom: 'contactFirstName',
  'first name': 'contactFirstName',
  firstname: 'contactFirstName',
  'contact nom': 'contactLastName',
  'nom contact': 'contactLastName',
  'nom de famille': 'contactLastName',
  'last name': 'contactLastName',
  lastname: 'contactLastName',
  'contact poste': 'contactRole',
  poste: 'contactRole',
  fonction: 'contactRole',
  role: 'contactRole',
  'job title': 'contactRole',
  'contact e mail': 'contactEmail',
  'contact email': 'contactEmail',
  email: 'contactEmail',
  'e mail': 'contactEmail',
  mail: 'contactEmail',
  courriel: 'contactEmail',
  'contact telephone': 'contactPhone',
  telephone: 'contactPhone',
  tel: 'contactPhone',
  phone: 'contactPhone',
  mobile: 'contactPhone',
  portable: 'contactPhone',
  'contact linkedin': 'contactLinkedin',
  linkedin: 'contactLinkedin',
  'profil linkedin': 'contactLinkedin',
}

export function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Champ correspondant à un intitulé de colonne, ou null si la colonne est ignorée
 * (colonnes d'export comme « Score » ou « Étape », colonnes inconnues)
 */
export function fieldForHeader(header: string): ImportField | null {
  const normalized = normalizeHeader(header)
  const fromLabels = (Object.entries(COLUMN_LABELS) as [ImportField, string][]).find(
    ([, label]) => normalizeHeader(label) === normalized
  )
  return fromLabels?.[0] ?? HEADER_ALIASES[normalized] ?? null
}

// « TPE (1 à 9 salariés) », « tpe », « PME » → catégorie
function parseSizeCategory(value: string | undefined): SizeCategory | null {
  const first = normalizeHeader(value ?? '').split(' ')[0]
  if (first === 'independant' || first === 'solo') return 'solo'
  if (first === 'tpe' || first === 'pme' || first === 'eti' || first === 'ge') return first
  if (first === 'grande') return 'ge'
  return null
}

const text = (max: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim()
      return trimmed ? trimmed.slice(0, max) : null
    })

export const companyImportRowSchema = z
  .object({
    name: z.string({ required_error: 'Nom manquant' }).trim().min(1, 'Nom manquant').max(200, 'Nom trop long'),
    website: text(500),
    // SIREN, ou SIRET (on garde alors les 9 premiers chiffres)
    registrationId: z
      .string()
      .optional()
      .transform((value) => {
        const digits = value?.replace(/\s/g, '') ?? ''
        if (/^\d{14}$/.test(digits)) return digits.slice(0, 9)
        return digits || null
      })
      .refine((value) => !value || /^\d{9}$/.test(value), 'SIREN invalide (9 chiffres)'),
    city: text(100),
    postalCode: text(10),
    sector: text(200),
    sizeCategory: z.string().optional().transform(parseSizeCategory),
    notes: text(5000),
    source: text(50),
    // « 6 000 € », « 6k »… ; une cellule illisible rend la ligne invalide plutôt que d'être ignorée
    estimatedAmount: z
      .string()
      .optional()
      .transform((value) => (value ? parseEuroAmount(value) : null))
      .refine(
        (value) => value === null || (Number.isInteger(value) && value >= 0 && value <= MAX_ESTIMATED_AMOUNT),
        'Montant estimé invalide'
      ),
    nextAction: text(300),
    contactFirstName: text(100),
    contactLastName: text(100),
    contactRole: text(200),
    contactEmail: z
      .string()
      .optional()
      .transform((value) => value?.trim().toLowerCase() || null)
      .refine((value) => !value || z.string().email().safeParse(value).success, 'E-mail du contact invalide'),
    contactPhone: text(30),
    contactLinkedin: text(500),
  })

export type CompanyImportRow = z.output<typeof companyImportRowSchema>

// Intitulés qui désignent sans ambiguïté l'entreprise
const EXPLICIT_COMPANY_HEADERS = new Set(['entreprise', 'societe', 'nom entreprise', 'raison sociale', 'company', 'company name'])

/**
 * Ligne du fichier (clés = intitulés d'origine) → champs reconnus.
 * Si une colonne désigne explicitement l'entreprise (« Entreprise », « Société »…),
 * une colonne « Nom » est lue comme le nom de famille du contact.
 */
export function mapRow(raw: Record<string, string>): Partial<Record<ImportField, string>> {
  const headers = Object.keys(raw).map(normalizeHeader)
  const hasExplicitCompany = headers.some((header) => EXPLICIT_COMPANY_HEADERS.has(header))

  const mapped: Partial<Record<ImportField, string>> = {}
  for (const [header, rawValue] of Object.entries(raw)) {
    // Apostrophe ajoutée par l'export devant une cellule « =… », « +… »… (voir la route d'export)
    const value = typeof rawValue === 'string' ? rawValue.replace(/^'(?=[=+\-@])/, '') : rawValue
    const normalized = normalizeHeader(header)
    const field =
      hasExplicitCompany && (normalized === 'nom' || normalized === 'name') ? 'contactLastName' : fieldForHeader(header)
    // Première colonne reconnue gagnante : une colonne « Nom » suivie de « Name » ne s'écrase pas
    if (field && mapped[field] === undefined) mapped[field] = value
  }
  return mapped
}

export function hasContact(row: CompanyImportRow): boolean {
  return !!(row.contactFirstName || row.contactLastName || row.contactEmail || row.contactLinkedin)
}
