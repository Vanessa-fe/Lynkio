// Détecteur « recherche par profil d'entreprise » (stratégies enregistrées, approches profile et partner)
//
// Pour chaque recherche active de l'utilisateur, Sophie interroge le registre officiel des entreprises
// (API Recherche d'entreprises : gratuite, sans clé, sans IA) avec les secteurs, la zone et les tailles
// choisis, page après page d'un passage à l'autre (curseur), et crée les entreprises qui conviennent.
// Aucun signal d'achat n'est inventé : la fiche dit seulement pourquoi elle correspond au profil.
//
// Toujours écartées : entreprises qui s'opposent à la prospection commerciale (registre), données
// non diffusibles, entrepreneurs individuels, siège hors de la zone, secteurs ignorés, mots-clés exclus,
// cabinets de recrutement et intérim (sauf si l'utilisateur les accepte), entreprises déjà connues.

import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFacingError, newSourceStats, skip, type Budget, type Context, type Settings, type SourceStats } from './context.ts'
import { PROFILE_MAX_PAGE, searchRegistryByProfile, type ProfileQuery, type RegistryCompany } from './sources.ts'
import { isNonDiffusible, isSoleProprietor, matchesExcludedKeyword, toTitleCase, truncate } from './rules.ts'
import { insertCompany, insertDirectors, knownSirens } from './store.ts'

// Pages lues au plus par recherche et par passage (25 entreprises par page)
const MAX_PAGES_PER_STRATEGY = 12
const NAF_CODE = /^\d{2}\.\d{2}[A-Z]$/
const DEPARTMENT = /^(\d{2,3}|2A|2B)$/

const HEADCOUNT_CODES: Record<string, string[]> = {
  tpe: ['01', '02', '03'],
  pme: ['11', '12', '21', '22', '31'],
  eti: ['32', '41', '42', '51'],
}

export type Strategy = {
  id: string
  name: string
  approach: 'profile' | 'partner'
  filters: { naf_codes?: unknown; departments?: unknown; sizes?: unknown }
  cursor: { page?: unknown }
}

/** Département d'un code postal (Corse : 2A/2B, outre-mer : 3 chiffres) */
export function departmentFromPostalCode(postalCode: string | null | undefined): string | null {
  if (!postalCode || !/^\d{5}$/.test(postalCode)) return null
  if (postalCode.startsWith('97') || postalCode.startsWith('98')) return postalCode.slice(0, 3)
  if (postalCode.startsWith('20')) return Number(postalCode) < 20200 ? '2A' : '2B'
  return postalCode.slice(0, 2)
}

/** Requête au registre d'après les filtres de la recherche (valeurs revérifiées ici) */
export function profileQuery(strategy: Strategy, fallbackDepartments: string[]): ProfileQuery | null {
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  const nafCodes = strings(strategy.filters.naf_codes).filter((code) => NAF_CODE.test(code))
  const chosenDepartments = strings(strategy.filters.departments).filter((code) => DEPARTMENT.test(code))
  const departments = chosenDepartments.length > 0 ? chosenDepartments : fallbackDepartments
  const sizes = strings(strategy.filters.sizes).filter((size) => size in HEADCOUNT_CODES)
  if (nafCodes.length === 0 || departments.length === 0) return null

  const effectiveSizes = sizes.length > 0 ? sizes : ['tpe', 'pme']
  return {
    nafCodes,
    departments,
    headcountCodes: effectiveSizes.flatMap((size) => HEADCOUNT_CODES[size] ?? []),
    // Sans ETI demandée, on écarte les filiales de groupes (catégorie INSEE autre que PME)
    categories: effectiveSizes.includes('eti') ? ['PME', 'ETI'] : ['PME'],
  }
}

export async function detectProfileMatches(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  budget: Budget
): Promise<{ stats: SourceStats; cursor: null }> {
  const stats = newSourceStats()

  let query = admin
    .from('prospect_strategies')
    .select('id, name, approach, filters, cursor')
    .eq('user_id', context.userId)
    .in('approach', ['profile', 'partner'])
    .order('created_at')
  query = context.strategyId ? query.eq('id', context.strategyId) : query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error

  const strategies = (data ?? []) as Strategy[]
  if (context.strategyId && strategies.length === 0) throw new UserFacingError('Cette recherche n’existe plus')

  for (let index = 0; index < strategies.length; index++) {
    if (budget.remaining <= 0) break
    const strategy = strategies[index]!
    // Quota partagé équitablement entre les recherches restantes
    const share = Math.ceil(budget.remaining / (strategies.length - index))
    await runStrategy(admin, settings, context, budget, stats, strategy, share)
  }

  return { stats, cursor: null }
}

async function runStrategy(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  budget: Budget,
  stats: SourceStats,
  strategy: Strategy,
  share: number
) {
  const query = profileQuery(strategy, settings.departments)
  if (!query) {
    skip(stats, `Recherche « ${strategy.name} » incomplète (secteur ou zone manquant)`)
    return
  }

  const departments = new Set(query.departments)
  const acceptsRecruiters =
    settings.accepted_intermediaries.includes('recruiters') || settings.accepted_intermediaries.includes('staffing')
  let page = typeof strategy.cursor.page === 'number' && strategy.cursor.page >= 1 ? strategy.cursor.page : 1
  let created = 0

  for (let read = 0; read < MAX_PAGES_PER_STRATEGY && created < share && budget.remaining > 0; read++) {
    const result = await searchRegistryByProfile(query, page)
    const lastPage = Math.max(result.totalPages, 1)
    // Fin des résultats (ou plafond de l'API) : on repart du début au passage suivant
    page = page >= lastPage || page >= PROFILE_MAX_PAGE ? 1 : page + 1
    if (result.results.length === 0) break

    const known = await knownSirens(
      admin,
      context.userId,
      result.results.map((company) => company.siren)
    )

    for (const company of result.results) {
      if (created >= share || budget.remaining <= 0) break
      stats.seen++

      const reason = exclusionReason(company, settings, context, departments, acceptsRecruiters, known)
      if (reason) {
        skip(stats, reason)
        continue
      }

      const companyId = await insertCompany(
        admin,
        context,
        {
          name: company.nom_raison_sociale ?? company.nom_complet,
          registrationId: company.siren,
          website: null,
          legalForm: null,
          city: company.siege?.libelle_commune ? toTitleCase(company.siege.libelle_commune) : null,
          postalCode: company.siege?.code_postal ?? null,
          notes: truncate(`Trouvée par votre recherche « ${strategy.name} » (registre officiel des entreprises).`, 500),
          strategyId: strategy.id,
        },
        company
      )
      if (!companyId) {
        skip(stats, 'Déjà dans vos entreprises')
        continue
      }

      known.add(company.siren)
      created++
      budget.remaining--
      stats.created++
      stats.createdCompanies.push({ id: companyId, name: company.nom_raison_sociale ?? company.nom_complet })
      await insertDirectors(admin, context.userId, companyId, company)
    }
  }

  const { error } = await admin
    .from('prospect_strategies')
    .update({ cursor: { page }, last_run_at: new Date().toISOString() })
    .eq('id', strategy.id)
    .eq('user_id', context.userId)
  if (error) console.error('strategy cursor', error)
}

function exclusionReason(
  company: RegistryCompany,
  settings: Settings,
  context: Context,
  departments: Set<string>,
  acceptsRecruiters: boolean,
  known: Set<string>
): string | null {
  if (known.has(company.siren)) return 'Déjà dans vos entreprises'
  if (company.opposition_diffusion_commerciale) return 'Refuse la prospection commerciale (registre)'
  if ((company.statut_diffusion && company.statut_diffusion !== 'O') || isNonDiffusible(company.nom_complet)) {
    return 'Données non diffusibles'
  }
  if (isSoleProprietor(company.nature_juridique)) return 'Entrepreneur individuel'
  const department = departmentFromPostalCode(company.siege?.code_postal)
  if (!department || !departments.has(department)) return 'Siège hors de votre zone'
  const section = company.section_activite_principale
  if (section && settings.excluded_naf_sections.includes(section)) return 'Secteur ignoré'
  if (company.activite_principale?.startsWith('78.') && !acceptsRecruiters) return 'Cabinet de recrutement ou intérim'
  const keyword = matchesExcludedKeyword(company.nom_complet, context.excludedKeywords)
  if (keyword) return `Mot-clé exclu (${keyword})`
  return null
}
