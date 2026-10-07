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
  companyname: 'name',
  name: 'name',
  site: 'website',
  'company website': 'website',
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
  jobtitle: 'contactRole',
  occupation: 'contactRole',
  'contact e mail': 'contactEmail',
  'contact email': 'contactEmail',
  email: 'contactEmail',
  'e mail': 'contactEmail',
  mail: 'contactEmail',
  proemail: 'contactEmail',
  linkedinemail: 'contactEmail',
  courriel: 'contactEmail',
  'contact telephone': 'contactPhone',
  telephone: 'contactPhone',
  tel: 'contactPhone',
  phone: 'contactPhone',
  mobile: 'contactPhone',
  phonenumbers: 'contactPhone',
  portable: 'contactPhone',
  'contact linkedin': 'contactLinkedin',
  linkedin: 'contactLinkedin',
  'profil linkedin': 'contactLinkedin',
  'linkedin url': 'contactLinkedin',
  linkedinurl: 'contactLinkedin',
  'profile url': 'contactLinkedin',
  profileurl: 'contactLinkedin',
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
    // Vide : la ligne décrit une personne seule (son nom vient alors des colonnes du contact)
    name: z
      .string()
      .trim()
      .max(200, 'Nom trop long')
      .optional()
      .transform((value) => value || null),
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
  .refine((row) => row.name || row.contactFirstName || row.contactLastName, {
    message: 'Nom manquant (entreprise ou personne)',
    path: ['name'],
  })

export type CompanyImportRow = z.output<typeof companyImportRowSchema>

/**
 * Fiche créée par une ligne : l'entreprise nommée, ou à défaut la personne seule du contact
 */
export function importRowFiche(row: CompanyImportRow): { name: string; kind: 'organization' | 'individual' } {
  if (row.name) return { name: row.name, kind: 'organization' }
  return { name: [row.contactFirstName, row.contactLastName].filter(Boolean).join(' '), kind: 'individual' }
}

// Intitulés qui désignent sans ambiguïté l'entreprise
const EXPLICIT_COMPANY_HEADERS = new Set(['entreprise', 'societe', 'nom entreprise', 'raison sociale', 'company', 'company name'])

/**
 * Ligne du fichier (clés = intitulés d'origine) → champs reconnus.
 * Si une colonne désigne explicitement l'entreprise (« Entreprise », « Société »…) ou s'il y a
 * une colonne « Prénom », une colonne « Nom » est lue comme le nom de famille du contact.
 */
export function mapRow(raw: Record<string, string>): Partial<Record<ImportField, string>> {
  const headers = Object.keys(raw).map(normalizeHeader)
  const hasExplicitCompany = headers.some((header) => EXPLICIT_COMPANY_HEADERS.has(header))
  // Avec une colonne « Prénom », le fichier décrit des personnes : « Nom » est leur nom de famille
  const hasFirstName = headers.some((header) => fieldForHeader(header) === 'contactFirstName')
  const nameIsPerson = hasExplicitCompany || hasFirstName

  const mapped: Partial<Record<ImportField, string>> = {}
  for (const [header, rawValue] of Object.entries(raw)) {
    // Apostrophe ajoutée par l'export devant une cellule « =… », « +… »… (voir la route d'export)
    const value = typeof rawValue === 'string' ? rawValue.replace(/^'(?=[=+\-@])/, '') : rawValue
    const normalized = normalizeHeader(header)
    const field =
      nameIsPerson && (normalized === 'nom' || normalized === 'name') ? 'contactLastName' : fieldForHeader(header)
    // Première colonne remplie gagnante : une colonne « Nom » suivie de « Name » ne s'écrase pas,
    // mais un « linkedinEmail » vide laisse la place au « proEmail » de Waalaxy
    if (field && !mapped[field]?.trim()) mapped[field] = value
  }
  return mapped
}

export function hasContact(row: CompanyImportRow): boolean {
  return !!(row.contactFirstName || row.contactLastName || row.contactEmail || row.contactLinkedin)
}

/**
 * Export de Waalaxy : en plus de la personne et de son entreprise, chaque ligne dit ce
 * qui s'est passé sur LinkedIn et par e-mail (dates au format AAAA-MM-JJ). On en tire
 * les échanges à noter dans Filonea, d'où le statut de la personne et l'étape de sa fiche.
 */
export type WaalaxyState = 'interested' | 'not_interested' | 'later_interested'

export type WaalaxyActivity = {
  invitedAt: string | null
  connectedAt: string | null
  firstMessageAt: string | null
  lastMessageAt: string | null
  linkedinReplyAt: string | null
  emailSentAt: string | null
  emailReplyAt: string | null
  // Texte de la dernière réponse détectée, et sa date
  replyText: string | null
  replyAt: string | null
  state: WaalaxyState | null
  // Liste Waalaxy d'où vient la personne (« prospectList »)
  list: string | null
}

const WAALAXY_COLUMNS = ['connectionRequestDate', 'firstMessageAt', 'messageSent', 'prospectList']

export function isWaalaxyFile(headers: string[]): boolean {
  return WAALAXY_COLUMNS.filter((column) => headers.includes(column)).length >= 3
}

const waalaxyDate = (value: string | undefined) => {
  const date = value?.trim().slice(0, 10)
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null
}

export function readWaalaxyActivity(raw: Record<string, string>): WaalaxyActivity {
  const state = raw.state?.trim()
  return {
    invitedAt: waalaxyDate(raw.connectionRequestDate),
    connectedAt: waalaxyDate(raw.connectedAt),
    firstMessageAt: waalaxyDate(raw.firstMessageAt),
    lastMessageAt: waalaxyDate(raw.lastLinkedinMessageSentDate),
    linkedinReplyAt: waalaxyDate(raw.lastLinkedinReplyDate),
    emailSentAt: waalaxyDate(raw.lastEmailSentDate),
    emailReplyAt: waalaxyDate(raw.lastEmailReplyDate),
    replyText: raw.lastReplyDetected?.trim().slice(0, 5000) || null,
    replyAt: waalaxyDate(raw.lastReplyDetectedDate),
    state: state === 'interested' || state === 'not_interested' || state === 'later_interested' ? state : null,
    list: raw.prospectList?.trim().slice(0, 100) || null,
  }
}

export type PlannedExchange = {
  type: 'linkedin_message' | 'email' | 'system_event'
  direction: 'outgoing' | 'incoming' | null
  date: string
  subject: string
  content: string | null
}

/**
 * Échanges à noter pour une ligne Waalaxy. Waalaxy ne donne que le premier et le dernier
 * message : s'ils diffèrent, le dernier est une relance. L'invitation et son acceptation
 * sont des événements : elles ne comptent pas comme un message (statut « À contacter »).
 */
export function waalaxyExchanges(activity: WaalaxyActivity): PlannedExchange[] {
  const exchanges: PlannedExchange[] = []
  const add = (exchange: Omit<PlannedExchange, 'date'>, date: string | null) => {
    if (date) exchanges.push({ ...exchange, date })
  }

  add({ type: 'system_event', direction: null, subject: 'Invitation LinkedIn envoyée (Waalaxy)', content: null }, activity.invitedAt)
  add({ type: 'system_event', direction: null, subject: 'Invitation LinkedIn acceptée (Waalaxy)', content: null }, activity.connectedAt)
  add({ type: 'linkedin_message', direction: 'outgoing', subject: 'Message LinkedIn (Waalaxy)', content: null }, activity.firstMessageAt)
  if (activity.lastMessageAt && activity.lastMessageAt !== activity.firstMessageAt) {
    add({ type: 'linkedin_message', direction: 'outgoing', subject: 'Relance LinkedIn (Waalaxy)', content: null }, activity.lastMessageAt)
  }
  add(
    {
      type: 'linkedin_message',
      direction: 'incoming',
      subject: 'Réponse LinkedIn (Waalaxy)',
      // Le texte de la dernière réponse, quand c'est bien celle-ci
      content: activity.replyAt === activity.linkedinReplyAt ? activity.replyText : null,
    },
    activity.linkedinReplyAt
  )
  add({ type: 'email', direction: 'outgoing', subject: 'E-mail (Waalaxy)', content: null }, activity.emailSentAt)
  add(
    {
      type: 'email',
      direction: 'incoming',
      subject: 'Réponse par e-mail (Waalaxy)',
      content: activity.replyAt === activity.emailReplyAt && activity.replyAt !== activity.linkedinReplyAt ? activity.replyText : null,
    },
    activity.emailReplyAt
  )
  return exchanges
}

/**
 * Même échange déjà noté (à la main ou par un import précédent) : même type, même sens,
 * même jour. C'est ce qui rend l'import d'un export Waalaxy rejouable sans doublon.
 */
export function exchangeKey(exchange: { type: string; direction: string | null; date: string; subject?: string | null }) {
  return exchange.type === 'system_event'
    ? `${exchange.type}|${exchange.subject ?? ''}`
    : `${exchange.type}|${exchange.direction ?? ''}|${exchange.date}`
}

export const waalaxyStateLabels: Record<WaalaxyState, string> = {
  interested: 'Intéressé·e',
  not_interested: 'Pas intéressé·e',
  later_interested: 'Intéressé·e plus tard',
}
