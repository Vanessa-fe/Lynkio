// Détecteur « entreprises qui utilisent votre stack » (recherche par technologie)
//
// Lancé à la demande depuis l'onglet Prospection (il coûte une recherche IA) :
// 1. l'IA cherche sur le web des TPE / PME dont le site utilise les technologies
//    du client idéal (criteria.tech_stack) ;
// 2. Sophie vérifie chaque site : sans la technologie dans son code, l'entreprise
//    est écartée, quoi qu'en dise l'IA ;
// 3. fiche officielle (SIREN, taille, chiffre d'affaires, dirigeants) et filtres
//    habituels (intermédiaires, taille, secteurs, mots-clés exclus).
// La stack détectée crée le signal « stack compatible » (trigger de la base).

import type { SupabaseClient } from '@supabase/supabase-js'
import { UserFacingError, newSourceStats, skip, type Budget, type Context, type Settings, type SourceStats } from './context.ts'
import { findCompaniesUsingTech, type TechCandidate } from './ai-research.ts'
import { detectSiteStack } from './site-stack.ts'
import { fetchRegistryCompany, searchRegistryByName, type RegistryCompany } from './sources.ts'
import { findSirenOnSite } from './legal-id.ts'
import {
  domainFromUrl,
  isConsultingFirm,
  isFreelancePlatform,
  isNonDiffusible,
  isRecruitmentFirm,
  matchesExcludedKeyword,
  normalizeCompanyName,
  sizeCategoryFromHeadcount,
  truncate,
} from './rules.ts'
import { findExistingCompany, insertCompany, insertDirectors } from './store.ts'

// Entreprises demandées à l'IA au plus par recherche (le coût et la durée en dépendent)
const MAX_CANDIDATES = 10

export const TECHNOLOGY_LABELS: Record<string, string> = {
  nextjs: 'Next.js',
  react: 'React',
  wordpress: 'WordPress',
  webflow: 'Webflow',
}

export async function detectTechUsers(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  budget: Budget
): Promise<{ stats: SourceStats; cursor: null }> {
  const stats = newSourceStats()
  const technologies = context.techStack.filter((technology) => technology in TECHNOLOGY_LABELS)

  if (technologies.length === 0) {
    throw new UserFacingError('Choisissez au moins une technologie dans votre client idéal (Paramètres, Client idéal)')
  }

  const count = Math.min(budget.remaining, MAX_CANDIDATES)
  if (count <= 0) return { stats, cursor: null }

  const candidates = await findCompaniesUsingTech(
    technologies.map((technology) => TECHNOLOGY_LABELS[technology]!),
    count,
    await knownDomains(admin, context.userId)
  )

  for (const candidate of candidates) {
    stats.seen++
    try {
      await processCandidate(admin, settings, context, budget, stats, candidate, technologies)
    } catch (error) {
      // Une vérification impossible (réseau, API) n'empêche pas de traiter les suivantes
      console.error('tech candidate', candidate.name, error)
      skip(stats, 'Vérification impossible (erreur réseau)')
    }
  }

  return { stats, cursor: null }
}

async function knownDomains(admin: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await admin
    .from('companies')
    .select('website_domain')
    .eq('user_id', userId)
    .not('website_domain', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error
  return (data ?? []).map((row: { website_domain: string }) => row.website_domain)
}

/**
 * Fiche officielle dont le nom correspond exactement (après normalisation) :
 * mieux vaut pas de fiche qu'une fiche d'une autre entreprise
 */
async function matchRegistry(name: string): Promise<RegistryCompany | null> {
  const key = normalizeCompanyName(name)
  const candidates = await searchRegistryByName(name, null)
  return (
    candidates.find((candidate) =>
      [
        candidate.nom_complet,
        candidate.nom_raison_sociale,
        candidate.sigle,
        candidate.siege?.nom_commercial,
        ...(candidate.siege?.liste_enseignes ?? []),
      ].some((candidateName) => candidateName && normalizeCompanyName(candidateName) === key)
    ) ?? null
  )
}

async function processCandidate(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  budget: Budget,
  stats: SourceStats,
  candidate: TechCandidate,
  technologies: string[]
) {
  if (isConsultingFirm(candidate.name) || isRecruitmentFirm(candidate.name) || isFreelancePlatform(candidate.name)) {
    skip(stats, 'ESN ou intermédiaire')
    return
  }

  if (await findExistingCompany(admin, context.userId, { website: candidate.website, name: candidate.name })) {
    skip(stats, 'Déjà dans vos entreprises')
    return
  }

  // L'IA propose, le site tranche
  const site = await detectSiteStack(candidate.website)
  if (!site) {
    skip(stats, 'Site injoignable')
    return
  }
  const matched = site.detected.filter((technology) => technologies.includes(technology))
  if (matched.length === 0) {
    skip(stats, 'Technologie non confirmée sur le site')
    return
  }

  // Même site sous une autre adresse (redirection) : déjà suivie ?
  if (
    domainFromUrl(site.finalUrl) !== domainFromUrl(candidate.website) &&
    (await findExistingCompany(admin, context.userId, { website: site.finalUrl }))
  ) {
    skip(stats, 'Déjà dans vos entreprises')
    return
  }

  // Fiche officielle : par le SIREN des mentions légales (fiable), sinon par le nom exact
  const legalSiren = await findSirenOnSite(site.finalUrl, site.html)
  const registry = (legalSiren ? await fetchRegistryCompany(legalSiren) : null) ?? (await matchRegistry(candidate.name))
  if (registry) {
    if (await findExistingCompany(admin, context.userId, { siren: registry.siren })) {
      skip(stats, 'Déjà dans vos entreprises')
      return
    }
    if (isNonDiffusible(registry.nom_complet)) {
      skip(stats, 'Données non diffusibles')
      return
    }
  }

  const size = sizeCategoryFromHeadcount(registry?.tranche_effectif_salarie ?? null)
  if (size && context.sizeCategories && !context.sizeCategories.includes(size)) {
    skip(stats, 'Taille hors cible')
    return
  }

  const section = registry?.section_activite_principale
  if (section && settings.excluded_naf_sections.includes(section)) {
    skip(stats, 'Secteur exclu')
    return
  }

  const excludedKeyword = matchesExcludedKeyword(`${candidate.name} ${candidate.activity}`, context.excludedKeywords)
  if (excludedKeyword) {
    skip(stats, `Mot-clé exclu (${excludedKeyword})`)
    return
  }

  if (budget.remaining <= 0) {
    skip(stats, 'Nombre maximum d\'entreprises atteint')
    return
  }

  const labels = matched.map((technology) => TECHNOLOGY_LABELS[technology]).join(', ')
  const notes = [
    `Trouvée par la recherche par technologie : ${labels} confirmé sur son site.`,
    legalSiren && registry?.siren === legalSiren ? 'SIREN lu dans les mentions légales du site.' : null,
    candidate.activity ? `Activité : ${candidate.activity}.` : null,
    candidate.evidence ? `Indice (recherche IA) : ${candidate.evidence}` : null,
    candidate.sourceUrl ? `Source : ${candidate.sourceUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const companyId = await insertCompany(
    admin,
    context,
    {
      name: candidate.name,
      registrationId: registry?.siren ?? null,
      website: site.finalUrl,
      legalForm: null,
      city: candidate.city || null,
      postalCode: null,
      notes: truncate(notes, 4000),
      detectedStack: site.detected,
    },
    registry
  )

  if (!companyId) {
    skip(stats, 'Déjà dans vos entreprises')
    return
  }

  budget.remaining--
  stats.created++
  stats.createdCompanies.push({ id: companyId, name: candidate.name })
  await insertDirectors(admin, context.userId, companyId, registry)
}
