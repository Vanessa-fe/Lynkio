'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { createClient } from '@/lib/supabase/server'
import { toWebsiteDomain } from '@/lib/validations/company'
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

export type ImportPreviewRow = {
  line: number
  name: string
  city: string | null
  contact: string | null
  status: 'ready' | 'duplicate' | 'invalid'
  // Erreurs de validation, ou entreprise déjà présente
  message: string | null
}

export type ImportPreview = {
  total: number
  ready: number
  duplicates: number
  invalid: number
  rows: ImportPreviewRow[]
}

type AnalyzedRow = {
  line: number
  status: ImportPreviewRow['status']
  message: string | null
  row: CompanyImportRow | null
  name: string
}

// Lignes de données : la ligne 1 du fichier est celle des intitulés
const FIRST_DATA_LINE = 2
const INSERT_BATCH_SIZE = 200

/**
 * Valide chaque ligne et repère les doublons : entreprises déjà suivies (SIREN,
 * domaine du site ou nom identique) et lignes répétées dans le fichier.
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

  const { data: existing, error } = await supabase
    .from('companies')
    .select('name, registration_id, website_domain')
    .eq('user_id', user.id)

  if (error) return { error: 'Impossible de lire vos entreprises' }

  const known = {
    sirens: new Map<string, string>(),
    domains: new Map<string, string>(),
    names: new Map<string, string>(),
  }
  // Valeur = message affiché si une ligne correspond
  for (const company of existing ?? []) {
    const message = `Déjà dans Lynkio : ${company.name}`
    if (company.registration_id) known.sirens.set(company.registration_id, message)
    if (company.website_domain) known.domains.set(company.website_domain, message)
    known.names.set(company.name.trim().toLowerCase(), message)
  }

  return rawRows.map((raw, index) => {
    const line = index + FIRST_DATA_LINE
    const mapped = mapRow(raw)
    const parsed = companyImportRowSchema.safeParse(mapped)

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
    const domain = toWebsiteDomain(row.website)
    const duplicateOf =
      (row.registrationId && known.sirens.get(row.registrationId)) ||
      (domain && known.domains.get(domain)) ||
      known.names.get(fiche.name.toLowerCase())

    if (duplicateOf) {
      return { line, status: 'duplicate', message: duplicateOf, row: null, name }
    }

    // Les lignes suivantes du fichier verront celle-ci comme déjà présente
    const inFile = `Déjà plus haut dans le fichier (ligne ${line})`
    if (row.registrationId) known.sirens.set(row.registrationId, inFile)
    if (domain) known.domains.set(domain, inFile)
    known.names.set(fiche.name.toLowerCase(), inFile)

    return { line, status: 'ready', message: null, row, name }
  })
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

    return {
      success: true,
      data: {
        total: analyzed.length,
        ready: analyzed.filter((row) => row.status === 'ready').length,
        duplicates: analyzed.filter((row) => row.status === 'duplicate').length,
        invalid: analyzed.filter((row) => row.status === 'invalid').length,
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
 * Importe les lignes valides et nouvelles. Les entreprises arrivent dans l'étape
 * par défaut ; la source est celle de la ligne si elle existe, sinon celle choisie.
 * Les scores sont calculés par la base à l'insertion.
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

    const ready = analyzed.filter((row): row is AnalyzedRow & { row: CompanyImportRow } => row.status === 'ready' && !!row.row)

    // Identifiants choisis ici : ils relient chaque contact à son entreprise sans relire la base
    const companies = ready.map(({ row }) => ({
      id: randomUUID(),
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
              ? 'Import impossible : aucune entreprise n\'a été ajoutée'
              : `Import interrompu : ${start} entreprises ajoutées, les suivantes non`,
        }
      }
    }

    // Contacts : un e-mail déjà utilisé par un autre contact n'est pas réimporté
    const withContact = ready
      .map(({ row }, index) => ({ row, companyId: companies[index]!.id }))
      .filter(({ row }) => hasContact(row))

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
        linkedin_url: row.contactLinkedin,
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

    // Les entreprises et personnes sont importées même si le rangement dans la liste échoue
    let list: { id: string; name: string; added: number } | null = null
    const listName = options.listName?.trim()
    if (listName && insertedIds.length > 0) {
      const listed = await addContactsToList({ listName }, insertedIds)
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
