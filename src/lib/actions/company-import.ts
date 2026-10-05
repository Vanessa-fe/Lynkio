'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { createClient } from '@/lib/supabase/server'
import { contactDisplayName, normalizeLinkedinProfileUrl, toWebsiteDomain } from '@/lib/validations/company'
import {
  MAX_IMPORT_ROWS,
  companyImportRowSchema,
  hasContact,
  importRowFiche,
  mapRow,
  type CompanyImportRow,
} from '@/lib/validations/company-import'
import { getAuthUser } from '@/lib/supabase/auth'
import { addContactsToList } from '@/lib/actions/prospect-lists'

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
}

export type ImportPreview = {
  total: number
  ready: number
  attach: number
  known: number
  duplicates: number
  invalid: number
  rows: ImportPreviewRow[]
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
 * Une personne est reconnue à son profil LinkedIn ou à son e-mail ; une entreprise à
 * son SIREN, au domaine de son site ou à son nom.
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

  const parsedRows = rawRows.map((raw) => {
    const mapped = mapRow(raw)
    return { mapped, parsed: companyImportRowSchema.safeParse(mapped) }
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

  const people = {
    linkedin: new Map<string, { contactId?: string; message: string }>(),
    email: new Map<string, { contactId?: string; message: string }>(),
  }
  for (const contact of [...byLinkedin, ...byEmail]) {
    const value = { contactId: contact.id, message: knownContact(contact) }
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

  const analyzed: AnalyzedRow[] = parsedRows.map(({ mapped, parsed }, index) => {
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
      }
    }

    const row = parsed.data
    const fiche = importRowFiche(row)
    const name = fiche.kind === 'individual' ? `${fiche.name} (personne seule)` : fiche.name
    const profile = normalizeLinkedinProfileUrl(row.contactLinkedin)

    // 1. La personne est-elle déjà connue (Lynkio ou plus haut dans le fichier) ?
    const person = (profile && people.linkedin.get(profile)) || (row.contactEmail && people.email.get(row.contactEmail))
    if (person) {
      return person.contactId
        ? { line, status: 'known', message: person.message, row, name, knownContactId: person.contactId }
        : { line, status: 'duplicate', message: person.message, row: null, name }
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
      // Personne seule déjà suivie, ou entreprise sans personne à ajouter
      if (fiche.kind === 'individual' || !hasContact(row)) {
        const message = 'line' in match.ref ? `Déjà plus haut dans le fichier (ligne ${match.ref.line})` : `Déjà dans Lynkio : ${match.name}`
        return { line, status: 'duplicate', message, row: null, name }
      }
      if ('line' in match.ref) {
        const names = namesByLine.get(match.ref.line)
        const key = personKey(row.contactFirstName, row.contactLastName)
        if (key && names?.has(key)) {
          return { line, status: 'duplicate', message: `Déjà plus haut dans le fichier (ligne ${match.ref.line})`, row: null, name }
        }
        if (key) names?.add(key)
      }
      const where = 'line' in match.ref ? `créée ligne ${match.ref.line}` : 'déjà dans Lynkio'
      return { line, status: 'attach', message: `Rejoint la fiche ${match.name} (${where})`, row, name, target: match.ref }
    }

    // 3. Nouvelle fiche : les lignes suivantes pourront la rejoindre
    const created: Known = { ref: { line }, name: fiche.name }
    if (row.registrationId) fiches.sirens.set(row.registrationId, created)
    if (domain) fiches.domains.set(domain, created)
    const names = fiche.kind === 'individual' ? fiches.individuals : fiches.organizations
    names.set(fiche.name.toLowerCase(), created)
    namesByLine.set(line, new Set([personKey(row.contactFirstName, row.contactLastName)].filter(Boolean)))

    return { line, status: 'ready', message: null, row, name }
  })

  // Une personne qui rejoint une entreprise déjà suivie, où quelqu'un porte déjà son nom :
  // c'est sans doute elle (fichier sans profil LinkedIn ni e-mail)
  const attachedToExisting = analyzed.filter(
    (row) => row.status === 'attach' && row.target && 'companyId' in row.target
  )
  if (attachedToExisting.length > 0) {
    const companyIds = attachedToExisting.map((row) => (row.target as { companyId: string }).companyId)
    const members = await contactsWhere(supabase, user.id, 'company_id', companyIds)
    const membersByCompany = new Map<string, Map<string, string>>()
    for (const member of members) {
      const key = personKey(member.first_name, member.last_name)
      if (!key) continue
      const byName = membersByCompany.get(member.company_id) ?? new Map<string, string>()
      byName.set(key, member.id)
      membersByCompany.set(member.company_id, byName)
    }
    for (const row of attachedToExisting) {
      const companyId = (row.target as { companyId: string }).companyId
      const memberId = membersByCompany.get(companyId)?.get(personKey(row.row!.contactFirstName, row.row!.contactLastName))
      if (memberId) {
        row.status = 'known'
        row.message = `Déjà dans Lynkio : ${[row.row!.contactFirstName, row.row!.contactLastName].filter(Boolean).join(' ')} (${companyNames.get(companyId)})`
        row.knownContactId = memberId
        row.target = undefined
      }
    }
  }

  return analyzed
}

function contactLabel(row: CompanyImportRow | null): string | null {
  if (!row || !hasContact(row)) return null
  return [row.contactFirstName, row.contactLastName].filter(Boolean).join(' ') || row.contactEmail
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
        })),
      },
    }
  } catch (error) {
    console.error('Preview companies import error:', error)
    return { success: false, error: 'Impossible d\'analyser le fichier' }
  }
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
  options: { sourceId: string | null; listName?: string | null }
): Promise<
  ActionResult<{
    imported: number
    contacts: number
    skippedContacts: number
    list: { id: string; name: string; added: number } | null
  }>
> {
  try {
    const analyzed = await analyzeRows(rawRows)
    if ('error' in analyzed) return { success: false, error: analyzed.error }

    const supabase = await createClient()
    const user = await getAuthUser()
    if (!user) return { success: false, error: 'Vous devez être connecté' }

    const [{ data: defaultStage }, { data: sources }] = await Promise.all([
      supabase.from('pipeline_stages').select('id').eq('user_id', user.id).eq('is_default', true).maybeSingle(),
      supabase.from('lead_sources').select('id, name').eq('user_id', user.id),
    ])
    const sourceByName = new Map((sources ?? []).map((source) => [source.name.trim().toLowerCase(), source.id]))
    const fallbackSourceId = sources?.some((source) => source.id === options.sourceId) ? options.sourceId : null

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
      ...ready.filter(({ row }) => hasContact(row)).map(({ line, row }) => ({ row, companyId: idByLine.get(line) })),
      ...attach.map(({ row, target }) => ({
        row,
        companyId: target && ('companyId' in target ? target.companyId : idByLine.get(target.line)),
      })),
    ].filter((item): item is { row: CompanyImportRow; companyId: string } => !!item.companyId)

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
      .map(({ row, companyId }) => ({
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
      const { data: inserted, error } = await supabase.from('company_contacts').insert(batch).select('id')
      if (error) {
        console.error('Import contacts error:', error)
        break
      }
      insertedIds.push(...(inserted ?? []).map((contact) => contact.id))
    }
    const insertedContacts = insertedIds.length

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
      },
    }
  } catch (error) {
    console.error('Import companies error:', error)
    return { success: false, error: 'Une erreur est survenue pendant l\'import' }
  }
}
