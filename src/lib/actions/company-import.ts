'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { createClient } from '@/lib/supabase/server'
import { contactDisplayName, normalizeLinkedinProfileUrl, toWebsiteDomain } from '@/lib/validations/company'
import {
  MAX_IMPORT_ROWS,
  companyImportRowSchema,
  exchangeKey,
  hasContact,
  importRowFiche,
  isWaalaxyFile,
  mapRow,
  readWaalaxyActivity,
  waalaxyExchanges,
  waalaxyStateLabels,
  type CompanyImportRow,
  type PlannedExchange,
  type WaalaxyActivity,
} from '@/lib/validations/company-import'
import { getAuthUser } from '@/lib/supabase/auth'
import { addContactsToList } from '@/lib/actions/prospect-lists'
import { SEGMENTS } from '@/lib/constants/segments'
import type { CompanySegment } from '@/types'

type ActionResult<T> = { success: boolean; error?: string; data?: T }

/**
 * Ce que deviendra chaque ligne :
 * - ready : nouvelle fiche (entreprise, ou personne seule), avec son contact s'il y en a un ;
 * - attach : la personne rejoint une entreprise déjà suivie, ou créée par une ligne plus haut ;
 * - known : la personne est déjà dans Lynkio (même profil LinkedIn ou même e-mail) ;
 * - duplicate : rien de nouveau (entreprise sans contact déjà suivie, ligne répétée) ;
 * - invalid : erreur dans la ligne.
 */
export type ImportRowStatus = 'ready' | 'attach' | 'known' | 'duplicate' | 'invalid'

export type ImportPreviewRow = {
  line: number
  name: string
  city: string | null
  contact: string | null
  status: ImportRowStatus
  // Erreurs de validation, fiche rejointe, personne ou entreprise déjà présente
  message: string | null
  // Export Waalaxy : ce qui sera noté (« Message 01/10 · Réponse 02/10 »)
  activity: string | null
}

export type ImportPreview = {
  total: number
  ready: number
  attach: number
  known: number
  duplicates: number
  invalid: number
  rows: ImportPreviewRow[]
  // Export Waalaxy : échanges à noter, et liste Waalaxy la plus fréquente du fichier
  waalaxy: { messages: number; replies: number; list: string | null } | null
}

// Fiche rejointe : déjà dans Lynkio, ou créée par une ligne plus haut dans le fichier
type FicheRef = { companyId: string } | { line: number }

type AnalyzedRow = {
  line: number
  status: ImportRowStatus
  message: string | null
  row: CompanyImportRow | null
  name: string
  target?: FicheRef
  // Personne déjà suivie : rangée dans la liste choisie, s'il y en a une
  knownContactId?: string
  knownCompanyId?: string
  // Export Waalaxy : activité lue, et échanges à noter (sans ceux déjà notés)
  activity: WaalaxyActivity | null
  exchanges: PlannedExchange[]
}

// Lignes de données : la ligne 1 du fichier est celle des intitulés
const FIRST_DATA_LINE = 2
const INSERT_BATCH_SIZE = 200
// Valeurs par requête « in » : l'adresse de la requête reste courte
const LOOKUP_CHUNK_SIZE = 100

type Supabase = Awaited<ReturnType<typeof createClient>>
type ExistingContact = {
  id: string
  company_id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  linkedin_url: string | null
}

function chunks<T>(values: T[], size = LOOKUP_CHUNK_SIZE): T[][] {
  const result: T[][] = []
  for (let start = 0; start < values.length; start += size) result.push(values.slice(start, start + size))
  return result
}

async function contactsWhere(
  supabase: Supabase,
  userId: string,
  column: 'linkedin_url' | 'email' | 'company_id',
  values: string[]
): Promise<ExistingContact[]> {
  const found: ExistingContact[] = []
  for (const part of chunks([...new Set(values)])) {
    const { data } = await supabase
      .from('company_contacts')
      .select('id, company_id, first_name, last_name, email, linkedin_url')
      .eq('user_id', userId)
      .in(column, part)
    found.push(...(data ?? []))
  }
  return found
}

const personKey = (firstName: string | null, lastName: string | null) =>
  [firstName, lastName].filter(Boolean).join(' ').trim().toLowerCase()

/**
 * Valide chaque ligne et décide de ce qu'elle deviendra (voir ImportRowStatus).
 * Une personne est reconnue à son profil LinkedIn, à son e-mail ou au nom de sa fiche
 * de personne seule ; une entreprise à son SIREN, au domaine de son site ou à son nom.
 * Export Waalaxy : prépare aussi les échanges à noter, sans ceux déjà notés.
 * Utilisée par l'aperçu ET par l'import, qui ne fait pas confiance à l'aperçu.
 */
async function analyzeRows(rawRows: Record<string, string>[]): Promise<AnalyzedRow[] | { error: string }> {
  const supabase = await createClient()
  const user = await getAuthUser()
  if (!user) return { error: 'Vous devez être connecté' }

  if (rawRows.length === 0) return { error: 'Le fichier ne contient aucune ligne' }
  if (rawRows.length > MAX_IMPORT_ROWS) {
    return { error: `Au plus ${MAX_IMPORT_ROWS} lignes par import : découpez le fichier` }
  }

  const fromWaalaxy = isWaalaxyFile(Object.keys(rawRows[0] ?? {}))
  const parsedRows = rawRows.map((raw) => {
    const mapped = mapRow(raw)
    return {
      mapped,
      parsed: companyImportRowSchema.safeParse(mapped),
      activity: fromWaalaxy ? readWaalaxyActivity(raw) : null,
    }
  })
  const validRows = parsedRows.flatMap(({ parsed }) => (parsed.success ? [parsed.data] : []))

  // Personnes déjà suivies, cherchées seulement parmi les profils et e-mails du fichier
  const linkedinValues = validRows.flatMap((row) => {
    const profile = normalizeLinkedinProfileUrl(row.contactLinkedin)
    return [profile, row.contactLinkedin].filter((value): value is string => !!value)
  })
  const emails = validRows.map((row) => row.contactEmail).filter((email): email is string => !!email)

  const [{ data: existing, error }, byLinkedin, byEmail] = await Promise.all([
    supabase.from('companies').select('id, name, kind, registration_id, website_domain').eq('user_id', user.id),
    contactsWhere(supabase, user.id, 'linkedin_url', linkedinValues),
    contactsWhere(supabase, user.id, 'email', emails),
  ])

  if (error) return { error: 'Impossible de lire vos entreprises' }

  const companyNames = new Map((existing ?? []).map((company) => [company.id, company.name]))
  const knownContact = (contact: ExistingContact) => {
    const person = contactDisplayName(contact)
    const fiche = companyNames.get(contact.company_id)
    return `Déjà dans Lynkio : ${person}${fiche && fiche !== person ? ` (${fiche})` : ''}`
  }

  type KnownPerson = { contactId?: string; companyId?: string; message: string }
  const people = {
    linkedin: new Map<string, KnownPerson>(),
    email: new Map<string, KnownPerson>(),
  }
  for (const contact of [...byLinkedin, ...byEmail]) {
    const value = { contactId: contact.id, companyId: contact.company_id, message: knownContact(contact) }
    const profile = normalizeLinkedinProfileUrl(contact.linkedin_url)
    if (profile) people.linkedin.set(profile, value)
    if (contact.email) people.email.set(contact.email.toLowerCase(), value)
  }

  // Entreprises (et personnes seules, à part) : fiche existante ou ligne qui la crée
  type Known = { ref: FicheRef; name: string }
  const fiches = {
    sirens: new Map<string, Known>(),
    domains: new Map<string, Known>(),
    organizations: new Map<string, Known>(),
    individuals: new Map<string, Known>(),
  }
  for (const company of existing ?? []) {
    const known: Known = { ref: { companyId: company.id }, name: company.name }
    if (company.registration_id) fiches.sirens.set(company.registration_id, known)
    if (company.website_domain) fiches.domains.set(company.website_domain, known)
    const names = company.kind === 'individual' ? fiches.individuals : fiches.organizations
    names.set(company.name.trim().toLowerCase(), known)
  }

  // Personnes rattachées à chaque fiche créée par le fichier (pour repérer les répétitions)
  const namesByLine = new Map<number, Set<string>>()

  const analyzed: AnalyzedRow[] = parsedRows.map(({ mapped, parsed, activity }, index) => {
    const line = index + FIRST_DATA_LINE

    if (!parsed.success) {
      return {
        line,
        status: 'invalid',
        message: [...new Set(parsed.error.errors.map((issue) => issue.message))].join(', '),
        row: null,
        name:
          mapped.name?.trim() ||
          [mapped.contactFirstName, mapped.contactLastName].filter(Boolean).join(' ').trim() ||
          '(sans nom)',
        activity: null,
        exchanges: [],
      }
    }

    const row = parsed.data
    const fiche = importRowFiche(row)
    const name = fiche.kind === 'individual' ? `${fiche.name} (personne seule)` : fiche.name
    const profile = normalizeLinkedinProfileUrl(row.contactLinkedin)
    const base = { line, row, name, activity, exchanges: [] as PlannedExchange[] }

    // 1. La personne est-elle déjà connue (Lynkio ou plus haut dans le fichier) ?
    const person = (profile && people.linkedin.get(profile)) || (row.contactEmail && people.email.get(row.contactEmail))
    if (person) {
      return person.contactId
        ? { ...base, status: 'known', message: person.message, knownContactId: person.contactId, knownCompanyId: person.companyId }
        : { ...base, status: 'duplicate', message: person.message, row: null, activity: null }
    }

    // 1 bis. Une personne seule déjà suivie, du même nom (saisie sans profil ni e-mail)
    const personName = personKey(row.contactFirstName, row.contactLastName)
    const alone = personName ? fiches.individuals.get(personName) : undefined
    if (alone && 'companyId' in alone.ref) {
      const hint = row.name ? ` : Waalaxy indique l'entreprise ${row.name}, rattachez-la depuis sa fiche si besoin` : ''
      return {
        ...base,
        status: 'known',
        message: `Déjà dans Lynkio : ${alone.name} (personne seule)${hint}`,
        knownCompanyId: alone.ref.companyId,
      }
    }

    const inFilePerson = { message: `Déjà plus haut dans le fichier (ligne ${line})` }
    if (profile) people.linkedin.set(profile, inFilePerson)
    if (row.contactEmail) people.email.set(row.contactEmail, inFilePerson)

    // 2. Sa fiche existe-t-elle déjà ?
    const domain = toWebsiteDomain(row.website)
    const match =
      fiche.kind === 'individual'
        ? fiches.individuals.get(fiche.name.toLowerCase())
        : (row.registrationId && fiches.sirens.get(row.registrationId)) ||
          (domain && fiches.domains.get(domain)) ||
          fiches.organizations.get(fiche.name.toLowerCase())

    if (match) {
      // Personne seule déjà dans le fichier, ou entreprise sans personne à ajouter
      if (fiche.kind === 'individual' || !hasContact(row)) {
        const message = 'line' in match.ref ? `Déjà plus haut dans le fichier (ligne ${match.ref.line})` : `Déjà dans Lynkio : ${match.name}`
        return { ...base, status: 'duplicate', message, row: null, activity: null }
      }
      if ('line' in match.ref) {
        const names = namesByLine.get(match.ref.line)
        if (personName && names?.has(personName)) {
          return {
            ...base,
            status: 'duplicate',
            message: `Déjà plus haut dans le fichier (ligne ${match.ref.line})`,
            row: null,
            activity: null,
          }
        }
        if (personName) names?.add(personName)
      }
      const where = 'line' in match.ref ? `créée ligne ${match.ref.line}` : 'déjà dans Lynkio'
      return { ...base, status: 'attach', message: `Rejoint la fiche ${match.name} (${where})`, target: match.ref }
    }

    // 3. Nouvelle fiche : les lignes suivantes pourront la rejoindre
    const created: Known = { ref: { line }, name: fiche.name }
    if (row.registrationId) fiches.sirens.set(row.registrationId, created)
    if (domain) fiches.domains.set(domain, created)
    const names = fiche.kind === 'individual' ? fiches.individuals : fiches.organizations
    names.set(fiche.name.toLowerCase(), created)
    namesByLine.set(line, new Set([personName].filter(Boolean)))

    return { ...base, status: 'ready', message: null }
  })

  // Contacts des fiches existantes : personne seule reconnue à son nom (son contact),
  // ou personne qui rejoint une entreprise où quelqu'un porte déjà son nom (c'est sans
  // doute elle, dans un fichier sans profil LinkedIn ni e-mail)
  const aloneRows = analyzed.filter((row) => row.status === 'known' && !row.knownContactId && row.knownCompanyId)
  const attachedToExisting = analyzed.filter(
    (row) => row.status === 'attach' && row.target && 'companyId' in row.target
  )
  const lookupIds = [
    ...aloneRows.map((row) => row.knownCompanyId!),
    ...attachedToExisting.map((row) => (row.target as { companyId: string }).companyId),
  ]
  if (lookupIds.length > 0) {
    const members = await contactsWhere(supabase, user.id, 'company_id', lookupIds)
    const membersByCompany = new Map<string, Map<string, string>>()
    const firstMember = new Map<string, string>()
    for (const member of members) {
      if (!firstMember.has(member.company_id)) firstMember.set(member.company_id, member.id)
      const key = personKey(member.first_name, member.last_name)
      if (!key) continue
      const byName = membersByCompany.get(member.company_id) ?? new Map<string, string>()
      byName.set(key, member.id)
      membersByCompany.set(member.company_id, byName)
    }
    for (const row of aloneRows) {
      row.knownContactId = firstMember.get(row.knownCompanyId!)
    }
    for (const row of attachedToExisting) {
      const companyId = (row.target as { companyId: string }).companyId
      const memberId = membersByCompany.get(companyId)?.get(personKey(row.row!.contactFirstName, row.row!.contactLastName))
      if (memberId) {
        row.status = 'known'
        row.message = `Déjà dans Lynkio : ${[row.row!.contactFirstName, row.row!.contactLastName].filter(Boolean).join(' ')} (${companyNames.get(companyId)})`
        row.knownContactId = memberId
        row.knownCompanyId = companyId
        row.target = undefined
      }
    }
  }

  // Export Waalaxy : échanges à noter. Pour une personne déjà suivie, on retire ceux
  // déjà notés (même type, même sens, même jour), à la main ou par un import précédent.
  if (fromWaalaxy) {
    const knownRows = analyzed.filter((row) => row.status === 'known' && row.knownContactId && row.knownCompanyId)
    const noted = new Map<string, Set<string>>()
    for (const part of chunks([...new Set(knownRows.map((row) => row.knownCompanyId!))])) {
      const { data } = await supabase
        .from('company_interactions')
        .select('company_id, contact_id, type, direction, subject, occurred_at')
        .eq('user_id', user.id)
        .eq('status', 'done')
        .in('company_id', part)
      for (const interaction of data ?? []) {
        const keys = noted.get(interaction.company_id) ?? new Set<string>()
        keys.add(
          `${interaction.contact_id ?? ''}#${exchangeKey({ ...interaction, date: interaction.occurred_at.slice(0, 10) })}`
        )
        noted.set(interaction.company_id, keys)
      }
    }

    for (const row of analyzed) {
      if (!row.activity || (row.status !== 'ready' && row.status !== 'attach' && row.status !== 'known')) continue
      const planned = waalaxyExchanges(row.activity)
      if (row.status !== 'known') {
        row.exchanges = planned
        continue
      }
      const keys = noted.get(row.knownCompanyId!) ?? new Set<string>()
      // Un échange noté sans personne compte aussi : la fiche n'a souvent qu'un contact
      row.exchanges = planned.filter((exchange) => {
        const key = exchangeKey(exchange)
        return !keys.has(`${row.knownContactId}#${key}`) && !keys.has(`#${key}`)
      })
    }
  }

  return analyzed
}

const shortDate = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/**
 * « Message 01/10 · Réponse 02/10 · Pas intéressé·e » : ce que l'import notera pour la ligne
 */
function activitySummary(row: AnalyzedRow): string | null {
  if (!row.activity) return null
  // Personne déjà suivie dont tout est déjà noté : son état Waalaxy est déjà appliqué
  if (row.status === 'known' && row.exchanges.length === 0) return 'Rien de nouveau'
  const labels = row.exchanges
    .filter((exchange) => exchange.type !== 'system_event' || !row.exchanges.some((other) => other.type !== 'system_event'))
    .map((exchange) => {
      if (exchange.type === 'system_event') {
        return exchange.subject.includes('acceptée') ? `Invitation acceptée ${shortDate(exchange.date)}` : `Invitation ${shortDate(exchange.date)}`
      }
      const what =
        exchange.direction === 'incoming'
          ? 'Réponse'
          : exchange.subject.startsWith('Relance')
            ? 'Relance'
            : exchange.type === 'email'
              ? 'E-mail'
              : 'Message'
      return `${what} ${shortDate(exchange.date)}`
    })
  if (row.activity.state && row.activity.state !== 'interested') labels.push(waalaxyStateLabels[row.activity.state])
  if (labels.length > 0) return labels.join(' · ')
  return row.status === 'known' ? 'Rien de nouveau' : null
}

function contactLabel(row: CompanyImportRow | null): string | null {
  if (!row || !hasContact(row)) return null
  return [row.contactFirstName, row.contactLastName].filter(Boolean).join(' ') || row.contactEmail
}

function waalaxySummary(analyzed: AnalyzedRow[]): ImportPreview['waalaxy'] {
  const withActivity = analyzed.filter((row) => row.activity)
  if (withActivity.length === 0) return null
  const exchanges = withActivity.flatMap((row) => row.exchanges)
  // Liste Waalaxy la plus fréquente : proposée comme liste Lynkio
  const counts = new Map<string, number>()
  for (const row of withActivity) {
    if (row.activity?.list) counts.set(row.activity.list, (counts.get(row.activity.list) ?? 0) + 1)
  }
  const list = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return {
    messages: exchanges.filter((exchange) => exchange.direction === 'outgoing').length,
    replies: exchanges.filter((exchange) => exchange.direction === 'incoming').length,
    list,
  }
}

export async function previewCompaniesImport(
  rawRows: Record<string, string>[]
): Promise<ActionResult<ImportPreview>> {
  try {
    const analyzed = await analyzeRows(rawRows)
    if ('error' in analyzed) return { success: false, error: analyzed.error }

    const count = (status: ImportRowStatus) => analyzed.filter((row) => row.status === status).length

    return {
      success: true,
      data: {
        total: analyzed.length,
        ready: count('ready'),
        attach: count('attach'),
        known: count('known'),
        duplicates: count('duplicate'),
        invalid: count('invalid'),
        rows: analyzed.map((row) => ({
          line: row.line,
          name: row.name,
          city: row.row?.city ?? null,
          contact: contactLabel(row.row),
          status: row.status,
          message: row.message,
          activity: activitySummary(row),
        })),
        waalaxy: waalaxySummary(analyzed),
      },
    }
  } catch (error) {
    console.error('Preview companies import error:', error)
    return { success: false, error: 'Impossible d\'analyser le fichier' }
  }
}

type StageRow = { id: string; kind: string; is_default: boolean; order: number }

/**
 * Export Waalaxy, une fois les personnes en place :
 * - note les échanges prévus par l'analyse (le statut de la personne et l'étape de sa
 *   fiche suivent tout seuls, par la base) ;
 * - complète le profil LinkedIn, l'e-mail et le poste des personnes déjà suivies qui n'en
 *   avaient pas ;
 * - « Pas intéressé·e » : la fiche passe en « Perdu » si elle était encore en cours ;
 *   « Intéressé·e plus tard » : une prochaine action est proposée si la fiche n'en a pas.
 */
async function applyWaalaxyActivity(
  supabase: Supabase,
  userId: string,
  stages: StageRow[],
  people: { row: AnalyzedRow; companyId: string; contactId: string }[]
): Promise<{ exchanges: number; enriched: number; lost: number }> {
  const withActivity = people.filter(({ row }) => row.activity)

  const interactions = withActivity.flatMap(({ row, companyId, contactId }) =>
    row.exchanges.map((exchange) => ({
      user_id: userId,
      company_id: companyId,
      contact_id: contactId,
      type: exchange.type,
      direction: exchange.direction,
      status: 'done' as const,
      subject: exchange.subject,
      content: exchange.content,
      // Waalaxy ne donne que le jour
      occurred_at: `${exchange.date}T12:00:00Z`,
    }))
  )
  let exchanges = 0
  for (let start = 0; start < interactions.length; start += INSERT_BATCH_SIZE) {
    const batch = interactions.slice(start, start + INSERT_BATCH_SIZE)
    const { error } = await supabase.from('company_interactions').insert(batch)
    if (error) {
      console.error('Import Waalaxy exchanges error:', error)
      break
    }
    exchanges += batch.length
  }

  // Personnes déjà suivies : on complète, sans jamais écraser ce qui est renseigné
  let enriched = 0
  const known = withActivity.filter(({ row }) => row.status === 'known')
  if (known.length > 0) {
    const existing = await contactsWhere(supabase, userId, 'company_id', known.map(({ companyId }) => companyId))
    const byId = new Map(existing.map((contact) => [contact.id, contact]))
    const { data: roles } = await supabase
      .from('company_contacts')
      .select('id, role')
      .eq('user_id', userId)
      .in('id', known.map(({ contactId }) => contactId))
    const roleById = new Map((roles ?? []).map((contact) => [contact.id, contact.role]))

    for (const { row, contactId } of known) {
      const contact = byId.get(contactId)
      if (!contact || !row.row) continue
      const update: { linkedin_url?: string; email?: string; role?: string } = {}
      const profile = normalizeLinkedinProfileUrl(row.row.contactLinkedin)
      if (!contact.linkedin_url && profile) update.linkedin_url = profile
      if (!contact.email && row.row.contactEmail) update.email = row.row.contactEmail
      if (!roleById.get(contactId) && row.row.contactRole) update.role = row.row.contactRole
      if (Object.keys(update).length === 0) continue
      const { error } = await supabase.from('company_contacts').update(update).eq('id', contactId).eq('user_id', userId)
      // Un e-mail déjà pris par un autre contact : on garde le reste
      if (error?.code === '23505' && update.email) {
        delete update.email
        if (Object.keys(update).length > 0) {
          const retry = await supabase.from('company_contacts').update(update).eq('id', contactId).eq('user_id', userId)
          if (!retry.error) enriched++
        }
      } else if (!error) {
        enriched++
      }
    }
  }

  // États Waalaxy, appliqués après les échanges (une réponse fait d'abord passer en discussion)
  let lost = 0
  const lostStage = stages.find((stage) => stage.kind === 'lost')
  const openStageIds = new Set(stages.filter((stage) => stage.kind === 'open').map((stage) => stage.id))
  const byState = (state: string) => [...new Set(withActivity.filter(({ row }) => row.activity?.state === state).map(({ companyId }) => companyId))]

  const notInterested = byState('not_interested')
  if (lostStage && notInterested.length > 0) {
    const { data: fiches } = await supabase.from('companies').select('id, stage_id').eq('user_id', userId).in('id', notInterested)
    const stillOpen = (fiches ?? []).filter((fiche) => !fiche.stage_id || openStageIds.has(fiche.stage_id)).map((fiche) => fiche.id)
    if (stillOpen.length > 0) {
      const { error } = await supabase.from('companies').update({ stage_id: lostStage.id }).eq('user_id', userId).in('id', stillOpen)
      if (!error) lost = stillOpen.length
    }
  }

  const later = byState('later_interested')
  if (later.length > 0) {
    await supabase
      .from('companies')
      .update({ next_action: 'Recontacter plus tard (intéressé·e plus tard, d\'après Waalaxy)' })
      .eq('user_id', userId)
      .in('id', later)
      .is('next_action', null)
  }

  return { exchanges, enriched, lost }
}

/**
 * Importe les nouvelles fiches et les personnes qui rejoignent une fiche. Les fiches
 * arrivent dans l'étape par défaut ; la source est celle de la ligne si elle existe,
 * sinon celle choisie. Les scores sont calculés par la base à l'insertion.
 * Les personnes déjà suivies ne sont pas modifiées : elles sont seulement rangées
 * dans la liste choisie.
 */
export async function importCompanies(
  rawRows: Record<string, string>[],
  // listName : liste où ranger les personnes importées (existante, ou créée à partir du nom)
  // segment : segment des nouvelles fiches ; sans lui, la base le devine
  options: { sourceId: string | null; listName?: string | null; segment?: CompanySegment | null }
): Promise<
  ActionResult<{
    imported: number
    contacts: number
    skippedContacts: number
    list: { id: string; name: string; added: number } | null
    // Export Waalaxy : échanges notés, personnes complétées, fiches passées en « Perdu »
    waalaxy: { exchanges: number; enriched: number; lost: number } | null
  }>
> {
  try {
    const analyzed = await analyzeRows(rawRows)
    if ('error' in analyzed) return { success: false, error: analyzed.error }

    const supabase = await createClient()
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const [{ data: stages }, { data: sources }] = await Promise.all([
      supabase.from('pipeline_stages').select('id, kind, is_default, order').eq('user_id', user.id).order('order'),
      supabase.from('lead_sources').select('id, name').eq('user_id', user.id),
    ])
    const defaultStage = stages?.find((stage) => stage.is_default)
    const sourceByName = new Map((sources ?? []).map((source) => [source.name.trim().toLowerCase(), source.id]))
    const fallbackSourceId = sources?.some((source) => source.id === options.sourceId) ? options.sourceId : null
    const segment = options.segment && (SEGMENTS as readonly string[]).includes(options.segment) ? options.segment : null

    type WithRow = AnalyzedRow & { row: CompanyImportRow }
    const ready = analyzed.filter((row): row is WithRow => row.status === 'ready' && !!row.row)
    const attach = analyzed.filter((row): row is WithRow => row.status === 'attach' && !!row.row)

    // Identifiants choisis ici : ils relient chaque contact à sa fiche sans relire la base
    const idByLine = new Map(ready.map(({ line }) => [line, randomUUID()]))
    const companies = ready.map(({ line, row }) => ({
      id: idByLine.get(line)!,
      user_id: user.id,
      origin: 'import' as const,
      kind: importRowFiche(row).kind,
      stage_id: defaultStage?.id ?? null,
      source_id: (row.source && sourceByName.get(row.source.toLowerCase())) || fallbackSourceId,
      name: importRowFiche(row).name,
      website: row.website,
      registration_id: row.registrationId,
      city: row.city,
      postal_code: row.postalCode,
      sector: row.sector,
      size_category: row.sizeCategory,
      notes: row.notes,
      estimated_amount: row.estimatedAmount,
      next_action: row.nextAction,
      ...(segment ? { segment, segment_set_by: 'manual' as const } : {}),
    }))

    for (let start = 0; start < companies.length; start += INSERT_BATCH_SIZE) {
      const { error } = await supabase.from('companies').insert(companies.slice(start, start + INSERT_BATCH_SIZE))
      if (error) {
        console.error('Import companies error:', error)
        return {
          success: false,
          error:
            start === 0
              ? 'Import impossible : aucune ligne n\'a été ajoutée'
              : `Import interrompu : ${start} fiches ajoutées, les suivantes non`,
        }
      }
    }

    // Contacts des nouvelles fiches, et personnes qui rejoignent une fiche
    const withContact = [
      ...ready.filter(({ row }) => hasContact(row)).map((item) => ({ item, companyId: idByLine.get(item.line) })),
      ...attach.map((item) => ({
        item,
        companyId: item.target && ('companyId' in item.target ? item.target.companyId : idByLine.get(item.target.line)),
      })),
    ]
      .filter((entry): entry is { item: WithRow; companyId: string } => !!entry.companyId)
      // Identifiant choisi ici : il relie les échanges Waalaxy de la ligne à la personne
      .map(({ item, companyId }) => ({ item, row: item.row, companyId, contactId: randomUUID() }))

    // Un e-mail déjà utilisé par un autre contact n'est pas réimporté
    const emails = withContact.map(({ row }) => row.contactEmail).filter((email): email is string => !!email)
    const { data: existingEmails } = emails.length
      ? await supabase.from('company_contacts').select('email').eq('user_id', user.id).in('email', emails)
      : { data: [] }
    const usedEmails = new Set((existingEmails ?? []).map((contact) => contact.email?.toLowerCase()))

    const contacts = withContact
      .filter(({ row }) => {
        if (!row.contactEmail) return true
        if (usedEmails.has(row.contactEmail)) return false
        usedEmails.add(row.contactEmail)
        return true
      })
      .map(({ row, companyId, contactId }) => ({
        id: contactId,
        user_id: user.id,
        company_id: companyId,
        first_name: row.contactFirstName,
        last_name: row.contactLastName,
        role: row.contactRole,
        email: row.contactEmail,
        email_source: row.contactEmail ? ('other' as const) : null,
        phone: row.contactPhone
          ? (parsePhoneNumberFromString(row.contactPhone, 'FR')?.format('E.164') ?? row.contactPhone)
          : null,
        // Profil au format standard : c'est par lui qu'on reconnaît la personne au prochain import
        linkedin_url: normalizeLinkedinProfileUrl(row.contactLinkedin) ?? row.contactLinkedin,
        // RGPD : origine de la donnée (la date de collecte est celle de l'import)
        data_source: 'import',
      }))

    const insertedIds: string[] = []
    for (let start = 0; start < contacts.length; start += INSERT_BATCH_SIZE) {
      const batch = contacts.slice(start, start + INSERT_BATCH_SIZE)
      const { error } = await supabase.from('company_contacts').insert(batch)
      if (error) {
        console.error('Import contacts error:', error)
        break
      }
      insertedIds.push(...batch.map((contact) => contact.id))
    }
    const insertedContacts = insertedIds.length
    const inserted = new Set(insertedIds)

    const waalaxy = analyzed.some((row) => row.activity)
      ? await applyWaalaxyActivity(supabase, user.id, stages ?? [], [
          // Personnes ajoutées par cet import
          ...withContact
            .filter(({ contactId }) => inserted.has(contactId))
            .map(({ item, companyId, contactId }) => ({ row: item, companyId, contactId })),
          // Personnes déjà suivies
          ...analyzed
            .filter((row) => row.status === 'known' && row.knownContactId && row.knownCompanyId)
            .map((row) => ({ row, companyId: row.knownCompanyId!, contactId: row.knownContactId! })),
        ])
      : null

    // Les fiches et personnes sont importées même si le rangement dans la liste échoue.
    // Les personnes déjà suivies y sont rangées aussi.
    let list: { id: string; name: string; added: number } | null = null
    const listName = options.listName?.trim()
    const knownIds = analyzed.flatMap((row) => (row.status === 'known' && row.knownContactId ? [row.knownContactId] : []))
    const toList = [...insertedIds, ...knownIds]
    if (listName && toList.length > 0) {
      const listed = await addContactsToList({ listName }, toList)
      if (listed.success && listed.data) list = { id: listed.data.listId, name: listName, added: listed.data.added }
      else console.error('Import list error:', listed.error)
    }

    revalidatePath('/companies')
    revalidatePath('/people')
    revalidatePath('/dashboard')
    return {
      success: true,
      data: {
        imported: companies.length,
        contacts: insertedContacts,
        skippedContacts: withContact.length - insertedContacts,
        list,
        waalaxy,
      },
    }
  } catch (error) {
    console.error('Import companies error:', error)
    return { success: false, error: 'Une erreur est survenue pendant l\'import' }
  }
}
