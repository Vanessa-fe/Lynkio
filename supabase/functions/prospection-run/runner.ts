import type { SupabaseClient } from '@supabase/supabase-js'
import {
  BODACC_PAGE_SIZE,
  bodaccActivity,
  bodaccActivityStart,
  bodaccLegalEntity,
  bodaccSiren,
  fetchBodaccCreations,
  fetchRegistryCompany,
  type BodaccCreation,
  type RegistryCompany,
} from './sources.ts'
import {
  NAF_SECTION_LABELS,
  daysAgo,
  isCivilCompany,
  isNonDiffusible,
  matchesExcludedKeyword,
  sizeCategoryFromHeadcount,
  summarizeActivity,
  toTitleCase,
  truncate,
} from './rules.ts'

// Premier passage : on remonte deux semaines de créations
const FIRST_RUN_LOOKBACK_DAYS = 14
// On lit les créations de la plus récente à la plus ancienne, jusqu'à la date
// du passage précédent. Le signal « créée récemment » vaut par sa fraîcheur :
// s'il y a plus de créations que le quota, les plus anciennes sont laissées de
// côté au lieu de s'accumuler d'un passage à l'autre.
// Garde-fou : nombre d'annonces examinées au plus par passage
const MAX_RECORDS_PER_RUN = 500
// Au-delà, un passage bloqué (fonction interrompue) est considéré comme échoué
const STALE_RUN_MINUTES = 15
const MAX_DIRECTORS = 3
const UNIQUE_VIOLATION = '23505'

type Settings = {
  departments: string[]
  excluded_naf_sections: string[]
  max_companies_per_run: number
  bodacc_cursor: string | null
}

type RunStats = {
  seen: number
  created: number
  skipped: number
  skipReasons: Record<string, number>
  createdCompanies: { id: string; name: string }[]
}

// Erreur dont le message peut être montré tel quel à l'utilisateur
class UserFacingError extends Error {}

export type StartResult = { ok: true; runId: string } | { ok: false; error: string }

/**
 * Ouvre un passage. La base garantit qu'il n'y en a qu'un en cours par utilisateur.
 */
export async function startRun(
  admin: SupabaseClient,
  userId: string,
  triggeredBy: 'manual' | 'schedule'
): Promise<StartResult> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MINUTES * 60_000).toISOString()

  await admin
    .from('pipeline_runs')
    .update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error: 'Passage interrompu avant la fin',
    })
    .eq('user_id', userId)
    .eq('status', 'running')
    .lt('started_at', staleBefore)

  const { data, error } = await admin
    .from('pipeline_runs')
    .insert({ user_id: userId, triggered_by: triggeredBy })
    .select('id')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { ok: false, error: 'Une prospection est déjà en cours' }
    }
    console.error('startRun', error)
    return { ok: false, error: 'Impossible de démarrer la prospection' }
  }

  return { ok: true, runId: data.id }
}

/**
 * Déroule un passage complet et l'enregistre dans pipeline_runs.
 * Toutes les écritures portent explicitement le user_id : la fonction utilise
 * la clé de service, la RLS ne s'applique donc pas.
 */
export async function runProspection(admin: SupabaseClient, userId: string, runId: string) {
  const stats: RunStats = { seen: 0, created: 0, skipped: 0, skipReasons: {}, createdCompanies: [] }
  let since = ''
  // Date de parution la plus récente vue : le prochain passage s'arrêtera là
  let newest: string | null = null

  try {
    const settings = await loadSettings(admin, userId)
    since = settings.bodacc_cursor ?? daysAgo(FIRST_RUN_LOOKBACK_DAYS)

    const context = await loadContext(admin, userId)

    let offset = 0
    let total = Infinity

    pages: while (offset < total && stats.seen < MAX_RECORDS_PER_RUN) {
      const page = await fetchBodaccCreations(settings.departments, since, offset)
      total = page.total
      offset += BODACC_PAGE_SIZE

      if (page.records.length === 0) break

      const known = await knownSirens(admin, userId, page.records)

      for (const record of page.records) {
        if (stats.created >= settings.max_companies_per_run || stats.seen >= MAX_RECORDS_PER_RUN) {
          break pages
        }

        stats.seen++
        if (!newest || record.dateparution > newest) newest = record.dateparution

        const siren = bodaccSiren(record)
        if (!siren) {
          skip(stats, 'SIREN illisible')
          continue
        }
        if (known.has(siren)) {
          skip(stats, 'Déjà dans vos entreprises')
          continue
        }

        const outcome = await processCreation(admin, userId, record, siren, settings, context)
        if (outcome.created) {
          known.add(siren)
          stats.created++
          stats.createdCompanies.push(outcome.created)
        } else {
          skip(stats, outcome.reason)
        }
      }
    }

    if (newest && newest !== settings.bodacc_cursor) {
      await admin.from('prospection_settings').update({ bodacc_cursor: newest }).eq('user_id', userId)
    }

    await finishRun(admin, runId, 'succeeded', stats, { since, until: newest, departments: settings.departments })
  } catch (error) {
    console.error('runProspection', error)
    const message =
      error instanceof UserFacingError
        ? error.message
        : `Erreur technique : ${error instanceof Error ? error.message : String(error)}`
    await finishRun(admin, runId, 'failed', stats, { since, until: newest }, message)
  }
}

function skip(stats: RunStats, reason: string) {
  stats.skipped++
  stats.skipReasons[reason] = (stats.skipReasons[reason] ?? 0) + 1
}

async function loadSettings(admin: SupabaseClient, userId: string): Promise<Settings> {
  const { data, error } = await admin
    .from('prospection_settings')
    .select('departments, excluded_naf_sections, max_companies_per_run, bodacc_cursor')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  if (!data || data.departments.length === 0) {
    throw new UserFacingError('Choisissez au moins un département dans les réglages de prospection')
  }
  return data as Settings
}

type Context = {
  stageId: string | null
  sourceId: string | null
  excludedKeywords: string[]
}

async function loadContext(admin: SupabaseClient, userId: string): Promise<Context> {
  const [stage, source, icp] = await Promise.all([
    admin.from('pipeline_stages').select('id').eq('user_id', userId).eq('is_default', true).maybeSingle(),
    admin
      .from('lead_sources')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'Détection automatique')
      .maybeSingle(),
    admin
      .from('icp_profiles')
      .select('criteria')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at')
      .limit(1)
      .maybeSingle(),
  ])

  const keywords = icp.data?.criteria?.exclude_keywords
  return {
    stageId: stage.data?.id ?? null,
    sourceId: source.data?.id ?? null,
    excludedKeywords: Array.isArray(keywords) ? keywords.filter((k): k is string => typeof k === 'string') : [],
  }
}

async function knownSirens(
  admin: SupabaseClient,
  userId: string,
  records: BodaccCreation[]
): Promise<Set<string>> {
  const sirens = records.map(bodaccSiren).filter((siren): siren is string => !!siren)
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

type ProcessOutcome = { created: { id: string; name: string }; reason?: never } | { created?: never; reason: string }

async function processCreation(
  admin: SupabaseClient,
  userId: string,
  record: BodaccCreation,
  siren: string,
  settings: Settings,
  context: Context
): Promise<ProcessOutcome> {
  const entity = bodaccLegalEntity(record)
  if (!entity) return { reason: 'Pas une société' }
  if (isCivilCompany(entity.formeJuridique)) return { reason: 'Société civile (SCI…)' }

  const registry = await fetchRegistryCompany(siren)
  if (registry && isNonDiffusible(registry.nom_complet)) return { reason: 'Données non diffusibles' }

  const section = registry?.section_activite_principale ?? null
  if (section && settings.excluded_naf_sections.includes(section)) return { reason: 'Secteur exclu' }

  const name = registry?.nom_raison_sociale ?? entity.denomination ?? record.commercant
  if (!name || isNonDiffusible(name)) return { reason: 'Nom manquant' }

  const activity = bodaccActivity(record)
  const excludedKeyword = matchesExcludedKeyword(`${name} ${activity ?? ''}`, context.excludedKeywords)
  if (excludedKeyword) return { reason: `Mot-clé exclu (${excludedKeyword})` }

  const companyId = await insertCompany(admin, userId, record, siren, name, entity.formeJuridique, activity, registry, context)
  if (!companyId) return { reason: 'Déjà dans vos entreprises' }

  await insertDirectors(admin, userId, companyId, registry)
  await insertCreationSignal(admin, userId, companyId, record, entity.formeJuridique, entity.capital, activity)

  return { created: { id: companyId, name } }
}

async function insertCompany(
  admin: SupabaseClient,
  userId: string,
  record: BodaccCreation,
  siren: string,
  name: string,
  legalForm: string | undefined,
  activity: string | null,
  registry: RegistryCompany | null,
  context: Context
): Promise<string | null> {
  const address = bodaccLegalEntity(record)?.adresseSiegeSocial
  const city = address?.ville ?? record.ville
  const section = registry?.section_activite_principale

  const { data, error } = await admin
    .from('companies')
    .insert({
      user_id: userId,
      origin: 'detector',
      stage_id: context.stageId,
      source_id: context.sourceId,
      name: truncate(name, 200),
      country: 'FR',
      registration_id: siren,
      legal_form: legalForm ?? null,
      naf_code: registry?.activite_principale ?? null,
      sector: section ? (NAF_SECTION_LABELS[section] ?? null) : null,
      headcount_code: registry?.tranche_effectif_salarie ?? null,
      size_category: sizeCategoryFromHeadcount(registry?.tranche_effectif_salarie ?? null),
      founded_on: registry?.date_creation ?? bodaccActivityStart(record),
      city: city ? toTitleCase(city) : null,
      postal_code: address?.codePostal ?? record.cp,
      notes: activity ? `Activité déclarée : ${summarizeActivity(activity)}` : null,
    })
    .select('id')
    .single()

  if (error) {
    // Course avec un autre passage ou une saisie manuelle : l'index unique a tranché
    if (error.code === UNIQUE_VIOLATION) return null
    throw error
  }
  return data.id
}

async function insertDirectors(
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

async function insertCreationSignal(
  admin: SupabaseClient,
  userId: string,
  companyId: string,
  record: BodaccCreation,
  legalForm: string | undefined,
  capital: { montantCapital?: string; devise?: string } | undefined,
  activity: string | null
) {
  const { error } = await admin.from('company_signals').insert({
    user_id: userId,
    company_id: companyId,
    signal_type: 'recently_created',
    dedupe_key: `bodacc:${record.id}`,
    source_url: record.url_complete,
    evidence: {
      source: 'bodacc',
      date_parution: record.dateparution,
      date_debut_activite: bodaccActivityStart(record),
      forme_juridique: legalForm ?? null,
      capital: capital?.montantCapital ? `${capital.montantCapital} ${capital.devise ?? 'EUR'}` : null,
      activite: activity ? truncate(activity, 500) : null,
    },
  })

  if (error && error.code !== UNIQUE_VIOLATION) console.error('insertCreationSignal', error)
}

async function finishRun(
  admin: SupabaseClient,
  runId: string,
  status: 'succeeded' | 'failed',
  stats: RunStats,
  extra: Record<string, unknown>,
  error?: string
) {
  const { error: updateError } = await admin
    .from('pipeline_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      companies_seen: stats.seen,
      companies_created: stats.created,
      companies_skipped: stats.skipped,
      error: error ?? null,
      details: {
        source: 'bodacc',
        ...extra,
        skip_reasons: stats.skipReasons,
        created: stats.createdCompanies.slice(0, 100),
      },
    })
    .eq('id', runId)

  if (updateError) console.error('finishRun', updateError)
}
