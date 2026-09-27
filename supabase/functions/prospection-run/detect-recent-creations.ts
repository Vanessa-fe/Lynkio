// Détecteur « sociétés tout juste créées » (BODACC), en option : une société
// qui vient de naître a rarement le budget d'un freelance.
//
// Les créations sont lues de la plus récente à la plus ancienne, jusqu'à la
// date du passage précédent : s'il y en a plus que le quota, les plus
// anciennes sont laissées de côté au lieu de s'accumuler.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  newSourceStats,
  skip,
  type Budget,
  type Context,
  type Settings,
  type SourceStats,
} from './context.ts'
import {
  BODACC_PAGE_SIZE,
  bodaccActivity,
  bodaccActivityStart,
  bodaccLegalEntity,
  bodaccSiren,
  fetchBodaccCreations,
  fetchRegistryCompany,
  type BodaccCreation,
} from './sources.ts'
import {
  daysAgo,
  isCivilCompany,
  isNonDiffusible,
  matchesExcludedKeyword,
  summarizeActivity,
  toTitleCase,
  truncate,
} from './rules.ts'
import { insertCompany, insertDirectors, insertSignal, knownSirens } from './store.ts'

// Premier passage : deux semaines de créations
const FIRST_RUN_LOOKBACK_DAYS = 14
// Garde-fou : nombre d'annonces examinées au plus par passage
const MAX_RECORDS_PER_RUN = 500

export async function detectRecentCreations(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  budget: Budget
): Promise<{ stats: SourceStats; cursor: string | null }> {
  const stats = newSourceStats()
  const since = settings.bodacc_cursor ?? daysAgo(FIRST_RUN_LOOKBACK_DAYS)
  stats.since = since
  let newest: string | null = null

  let offset = 0
  let total = Infinity

  pages: while (offset < total && stats.seen < MAX_RECORDS_PER_RUN) {
    const page = await fetchBodaccCreations(settings.departments, since, offset)
    total = page.total
    offset += BODACC_PAGE_SIZE

    if (page.records.length === 0) break

    const sirens = page.records.map(bodaccSiren).filter((siren): siren is string => !!siren)
    const known = await knownSirens(admin, context.userId, sirens)

    for (const record of page.records) {
      if (budget.remaining <= 0 || stats.seen >= MAX_RECORDS_PER_RUN) break pages

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

      const reason = await processCreation(admin, settings, context, stats, record, siren)
      if (reason) {
        skip(stats, reason)
      } else {
        known.add(siren)
        budget.remaining--
      }
    }
  }

  stats.until = newest
  return { stats, cursor: newest }
}

/**
 * Crée l'entreprise ; renvoie la raison de l'exclusion le cas échéant
 */
async function processCreation(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  stats: SourceStats,
  record: BodaccCreation,
  siren: string
): Promise<string | null> {
  const entity = bodaccLegalEntity(record)
  if (!entity) return 'Pas une société'
  if (isCivilCompany(entity.formeJuridique)) return 'Société civile (SCI…)'

  const registry = await fetchRegistryCompany(siren)
  if (registry && isNonDiffusible(registry.nom_complet)) return 'Données non diffusibles'

  const section = registry?.section_activite_principale ?? null
  if (section && settings.excluded_naf_sections.includes(section)) return 'Secteur exclu'

  const name = registry?.nom_raison_sociale ?? entity.denomination ?? record.commercant
  if (!name || isNonDiffusible(name)) return 'Nom manquant'

  const activity = bodaccActivity(record)
  const excludedKeyword = matchesExcludedKeyword(`${name} ${activity ?? ''}`, context.excludedKeywords)
  if (excludedKeyword) return `Mot-clé exclu (${excludedKeyword})`

  const address = entity.adresseSiegeSocial
  const city = address?.ville ?? record.ville

  const companyId = await insertCompany(
    admin,
    context,
    {
      name,
      registrationId: siren,
      website: null,
      legalForm: entity.formeJuridique ?? null,
      city: city ? toTitleCase(city) : null,
      postalCode: address?.codePostal ?? record.cp,
      notes: activity ? `Activité déclarée : ${summarizeActivity(activity)}` : null,
      foundedOn: bodaccActivityStart(record),
    },
    registry
  )
  if (!companyId) return 'Déjà dans vos entreprises'

  stats.created++
  stats.createdCompanies.push({ id: companyId, name })

  await insertDirectors(admin, context.userId, companyId, registry)
  await insertSignal(admin, context.userId, companyId, {
    type: 'recently_created',
    dedupeKey: `bodacc:${record.id}`,
    sourceUrl: record.url_complete,
    evidence: {
      source: 'bodacc',
      date_parution: record.dateparution,
      date_debut_activite: bodaccActivityStart(record),
      forme_juridique: entity.formeJuridique ?? null,
      capital: entity.capital?.montantCapital
        ? `${entity.capital.montantCapital} ${entity.capital.devise ?? 'EUR'}`
        : null,
      activite: activity ? truncate(activity, 500) : null,
    },
  })

  return null
}
