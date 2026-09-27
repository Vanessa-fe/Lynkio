// Écritures en base communes aux détecteurs. La fonction utilise la clé de
// service (la RLS ne s'applique pas) : chaque requête filtre ou écrit
// explicitement le user_id.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Context } from './context.ts'
import type { RegistryCompany } from './sources.ts'
import {
  NAF_SECTION_LABELS,
  domainFromUrl,
  isNonDiffusible,
  sizeCategoryFromHeadcount,
  toTitleCase,
  truncate,
} from './rules.ts'

const MAX_DIRECTORS = 3
export const UNIQUE_VIOLATION = '23505'

export type CompanyDraft = {
  name: string
  registrationId: string | null
  website: string | null
  legalForm: string | null
  city: string | null
  postalCode: string | null
  notes: string | null
  // Si la fiche officielle manque (ex. date de début d'activité au BODACC)
  foundedOn?: string | null
}

/**
 * SIREN déjà présents parmi les entreprises de l'utilisateur
 */
export async function knownSirens(admin: SupabaseClient, userId: string, sirens: string[]): Promise<Set<string>> {
  if (sirens.length === 0) return new Set()

  const { data, error } = await admin
    .from('companies')
    .select('registration_id')
    .eq('user_id', userId)
    .eq('country', 'FR')
    .in('registration_id', sirens)

  if (error) throw error
  return new Set((data ?? []).map((row: { registration_id: string }) => row.registration_id))
}

/**
 * Entreprise déjà suivie : par SIREN, sinon par domaine du site, sinon par nom exact
 * (sans tenir compte de la casse). Le nom seul ne sert qu'en dernier recours.
 */
export async function findExistingCompany(
  admin: SupabaseClient,
  userId: string,
  { siren, website, name }: { siren?: string | null; website?: string | null; name?: string | null }
): Promise<{ id: string; name: string } | null> {
  const domain = domainFromUrl(website)
  const lookups: [string, string, 'eq' | 'ilike'][] = []
  if (siren) lookups.push(['registration_id', siren, 'eq'])
  if (domain) lookups.push(['website_domain', domain, 'eq'])
  // ilike sans joker : égalité insensible à la casse (on neutralise % et _)
  if (name) lookups.push(['name', name.replace(/[\\%_]/g, (char) => `\\${char}`), 'ilike'])

  for (const [column, value, operator] of lookups) {
    const query = admin.from('companies').select('id, name').eq('user_id', userId)
    const { data, error } = await (operator === 'eq' ? query.eq(column, value) : query.ilike(column, value))
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  return null
}

/**
 * Crée l'entreprise, complétée par la fiche officielle quand on l'a.
 * Renvoie null si un index unique signale un doublon (course avec un autre ajout).
 */
export async function insertCompany(
  admin: SupabaseClient,
  context: Context,
  draft: CompanyDraft,
  registry: RegistryCompany | null
): Promise<string | null> {
  const section = registry?.section_activite_principale
  const headquarters = registry?.siege

  const { data, error } = await admin
    .from('companies')
    .insert({
      user_id: context.userId,
      origin: 'detector',
      stage_id: context.stageId,
      source_id: context.sourceId,
      name: truncate(draft.name, 200),
      country: 'FR',
      registration_id: draft.registrationId ?? registry?.siren ?? null,
      website: draft.website,
      legal_form: draft.legalForm,
      naf_code: registry?.activite_principale ?? null,
      sector: section ? (NAF_SECTION_LABELS[section] ?? null) : null,
      headcount_code: registry?.tranche_effectif_salarie ?? null,
      size_category: sizeCategoryFromHeadcount(registry?.tranche_effectif_salarie ?? null),
      // Ancienneté : affichée sur la fiche, pas utilisée pour sélectionner
      founded_on: registry?.date_creation ?? draft.foundedOn ?? null,
      city: headquarters?.libelle_commune ? toTitleCase(headquarters.libelle_commune) : draft.city,
      postal_code: headquarters?.code_postal ?? draft.postalCode,
      notes: draft.notes,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return null
    throw error
  }
  return data.id
}

/**
 * Dirigeants (personnes physiques) de la fiche officielle, ajoutés comme contacts décideurs
 */
export async function insertDirectors(
  admin: SupabaseClient,
  userId: string,
  companyId: string,
  registry: RegistryCompany | null
) {
  const directors = (registry?.dirigeants ?? [])
    .filter(
      (director) =>
        director.type_dirigeant === 'personne physique' &&
        director.nom &&
        !isNonDiffusible(director.nom) &&
        !isNonDiffusible(director.prenoms)
    )
    .slice(0, MAX_DIRECTORS)

  if (directors.length === 0) return

  const { error } = await admin.from('company_contacts').insert(
    directors.map((director) => ({
      user_id: userId,
      company_id: companyId,
      // Premier prénom seulement : l'état civil liste tous les prénoms
      first_name: director.prenoms ? toTitleCase(director.prenoms.split(/\s+/)[0] ?? '') : null,
      last_name: toTitleCase(director.nom ?? ''),
      role: director.qualite ?? null,
      is_decision_maker: true,
      data_source: 'recherche-entreprises',
    }))
  )

  // Un contact manquant n'empêche pas de garder l'entreprise
  if (error) console.error('insertDirectors', error)
}

/**
 * Ajoute un signal. Renvoie false s'il existait déjà (même dedupe_key)
 */
export async function insertSignal(
  admin: SupabaseClient,
  userId: string,
  companyId: string,
  signal: { type: string; dedupeKey: string; sourceUrl: string | null; evidence: Record<string, unknown> }
): Promise<boolean> {
  const { error } = await admin.from('company_signals').insert({
    user_id: userId,
    company_id: companyId,
    signal_type: signal.type,
    dedupe_key: signal.dedupeKey,
    source_url: signal.sourceUrl,
    evidence: signal.evidence,
  })

  if (!error) return true
  if (error.code === UNIQUE_VIOLATION) return false
  throw error
}
