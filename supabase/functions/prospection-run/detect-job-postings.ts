// Détecteur « entreprises qui recrutent » (offres d'emploi France Travail)
//
// Une entreprise qui publie une offre de développeur a un besoin et un budget.
// Pour chaque entreprise trouvée :
// - déjà suivie → on lui ajoute le signal (elle recrute à nouveau), sans doublon ;
// - sinon → on la crée, complétée par sa fiche officielle quand on la retrouve
//   (SIREN, ancienneté, taille, dirigeants).

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  newSourceStats,
  skip,
  type Budget,
  type Context,
  type Settings,
  type SourceStats,
} from './context.ts'
import { fetchJobOffers, offerUrl, type JobOffer } from './france-travail.ts'
import { searchRegistryByName, type RegistryCompany } from './sources.ts'
import {
  isIntermediary,
  isNonDiffusible,
  matchesExcludedKeyword,
  nafSectionFromDivision,
  normalizeCompanyName,
  summarizeActivity,
  toTitleCase,
} from './rules.ts'
import { findExistingCompany, insertCompany, insertDirectors, insertSignal } from './store.ts'

// Premier passage : offres publiées depuis deux semaines
const FIRST_RUN_LOOKBACK_DAYS = 14
// Garde-fou : nombre d'offres examinées au plus par passage
const MAX_OFFERS_PER_RUN = 600

// Métiers recherchés dans les offres (codes ROME) pour chaque signal d'offre d'emploi.
// Le métier de l'utilisateur (profession_signals) décide lesquels sont utilisés.
// Codes du ROME 4.0 (2025) : le développement web a son propre code (M1855),
// de loin le plus utilisé dans les offres de développeur.
const JOB_SIGNAL_ROME_CODES: Record<string, string[]> = {
  job_posting_dev: [
    'M1855', // Développeur / Développeuse web
    'M1861', // Développeur / Développeuse logiciel ou d'application
    'M1805', // Développeur / Développeuse informatique
  ],
  job_posting_design: ['E1205'], // Réalisation de contenus multimédias
  job_posting_marketing: ['M1705'], // Marketing
}

// Division NAF 78 : agences d'intérim et cabinets de recrutement (ils recrutent pour d'autres)
const RECRUITMENT_DIVISION = '78'

type OfferGroup = { key: string; name: string; offers: JobOffer[] }

export async function detectJobPostings(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  budget: Budget
): Promise<{ stats: SourceStats; cursor: string | null }> {
  const stats = newSourceStats()
  const since = settings.job_postings_cursor
    ? new Date(settings.job_postings_cursor)
    : new Date(Date.now() - FIRST_RUN_LOOKBACK_DAYS * 86_400_000)
  stats.since = since.toISOString()

  const signalTypes = await jobSignalTypes(admin, context.professionKey)
  const romeToSignal = new Map(
    signalTypes.flatMap((type) => (JOB_SIGNAL_ROME_CODES[type] ?? []).map((code) => [code, type] as const))
  )

  const offers = await fetchJobOffers(settings.departments, [...romeToSignal.keys()], since, MAX_OFFERS_PER_RUN)
  const newest = offers.reduce<string | null>(
    (latest, offer) => (offer.dateCreation && (!latest || offer.dateCreation > latest) ? offer.dateCreation : latest),
    null
  )
  stats.until = newest

  for (const group of groupByCompany(offers, stats)) {
    await processCompany(admin, settings, context, budget, stats, group, romeToSignal)
  }

  return { stats, cursor: newest }
}

/**
 * Signaux d'offre d'emploi utiles au métier de l'utilisateur (développeur par défaut)
 */
async function jobSignalTypes(admin: SupabaseClient, professionKey: string | null): Promise<string[]> {
  if (professionKey) {
    const { data, error } = await admin
      .from('profession_signals')
      .select('signal_type')
      .eq('profession_key', professionKey)
      .in('signal_type', Object.keys(JOB_SIGNAL_ROME_CODES))

    if (error) throw error
    const types = (data ?? []).map((row: { signal_type: string }) => row.signal_type)
    if (types.length > 0) return types
  }
  return ['job_posting_dev']
}

/**
 * Regroupe les offres par entreprise (une entreprise peut publier plusieurs offres)
 * et écarte celles qui ne mènent pas à un client possible
 */
function groupByCompany(offers: JobOffer[], stats: SourceStats): OfferGroup[] {
  const groups = new Map<string, OfferGroup>()

  for (const offer of offers) {
    stats.seen++
    const name = offer.entreprise?.nom?.trim()

    if (!name) {
      skip(stats, 'Offre sans nom d\'entreprise')
      continue
    }
    if (offer.secteurActivite === RECRUITMENT_DIVISION) {
      skip(stats, 'Cabinet de recrutement ou intérim')
      continue
    }
    if (isIntermediary(name)) {
      skip(stats, 'Plateforme freelance ou cabinet intermédiaire')
      continue
    }
    if (offer.typeContrat === 'MIS') {
      skip(stats, 'Mission d\'intérim')
      continue
    }

    const key = normalizeCompanyName(name)
    const group = groups.get(key) ?? { key, name, offers: [] }
    group.offers.push(offer)
    groups.set(key, group)
  }

  return [...groups.values()]
}

function skipGroup(stats: SourceStats, group: OfferGroup, reason: string) {
  for (let i = 0; i < group.offers.length; i++) skip(stats, reason)
}

// Département de l'offre, déduit du code postal (97x pour l'outre-mer, 2A/2B pour la Corse)
function departmentOf(offer: JobOffer): string | null {
  const postalCode = offer.lieuTravail?.codePostal
  if (!postalCode || !/^\d{5}$/.test(postalCode)) return null
  if (postalCode.startsWith('97')) return postalCode.slice(0, 3)
  if (postalCode.startsWith('20')) return Number(postalCode) < 20200 ? '2A' : '2B'
  return postalCode.slice(0, 2)
}

/**
 * Retrouve la fiche officielle : seulement si le nom correspond exactement
 * (après normalisation). Mieux vaut pas de fiche qu'une fiche d'une autre entreprise.
 */
async function matchRegistry(group: OfferGroup): Promise<RegistryCompany | null> {
  const offer = group.offers[0]
  if (!offer) return null

  const candidates = await searchRegistryByName(group.name, departmentOf(offer))
  return (
    candidates.find((candidate) =>
      [
        candidate.nom_complet,
        candidate.nom_raison_sociale,
        candidate.sigle,
        candidate.siege?.nom_commercial,
        ...(candidate.siege?.liste_enseignes ?? []),
      ].some((candidateName) => candidateName && normalizeCompanyName(candidateName) === group.key)
    ) ?? null
  )
}

async function processCompany(
  admin: SupabaseClient,
  settings: Settings,
  context: Context,
  budget: Budget,
  stats: SourceStats,
  group: OfferGroup,
  romeToSignal: Map<string, string>
) {
  const website = group.offers.find((offer) => offer.entreprise?.url)?.entreprise?.url ?? null

  const existing = await findExistingCompany(admin, context.userId, { website, name: group.name })
  if (existing) {
    await addSignals(admin, context, stats, existing.id, group, romeToSignal)
    return
  }

  if (budget.remaining <= 0) {
    skipGroup(stats, group, 'Nombre maximum d\'entreprises atteint')
    return
  }

  const registry = await matchRegistry(group)

  if (registry) {
    const known = await findExistingCompany(admin, context.userId, { siren: registry.siren })
    if (known) {
      await addSignals(admin, context, stats, known.id, group, romeToSignal)
      return
    }
    if (isNonDiffusible(registry.nom_complet)) {
      skipGroup(stats, group, 'Données non diffusibles')
      return
    }
  }

  const section = registry?.section_activite_principale ?? nafSectionFromDivision(group.offers[0]?.secteurActivite)
  if (section && settings.excluded_naf_sections.includes(section)) {
    skipGroup(stats, group, 'Secteur exclu')
    return
  }

  const titles = group.offers.map((offer) => offer.intitule ?? '').join(' ')
  const excludedKeyword = matchesExcludedKeyword(`${group.name} ${titles}`, context.excludedKeywords)
  if (excludedKeyword) {
    skipGroup(stats, group, `Mot-clé exclu (${excludedKeyword})`)
    return
  }

  const firstOffer = group.offers[0]
  const description = group.offers.find((offer) => offer.entreprise?.description)?.entreprise?.description

  const companyId = await insertCompany(
    admin,
    context,
    {
      // Le nom de l'offre est celui sous lequel l'entreprise se présente
      name: group.name,
      registrationId: registry?.siren ?? null,
      website,
      legalForm: null,
      city: cityFromLabel(firstOffer?.lieuTravail?.libelle),
      postalCode: firstOffer?.lieuTravail?.codePostal ?? null,
      notes: description ? `Présentation (offre France Travail) : ${summarizeActivity(description)}` : null,
    },
    registry
  )

  if (!companyId) {
    skipGroup(stats, group, 'Déjà dans vos entreprises')
    return
  }

  budget.remaining--
  stats.created++
  stats.createdCompanies.push({ id: companyId, name: group.name })

  await insertDirectors(admin, context.userId, companyId, registry)
  for (const offer of group.offers) {
    await insertSignal(admin, context.userId, companyId, offerSignal(offer, romeToSignal))
  }
}

async function addSignals(
  admin: SupabaseClient,
  context: Context,
  stats: SourceStats,
  companyId: string,
  group: OfferGroup,
  romeToSignal: Map<string, string>
) {
  let added = 0
  for (const offer of group.offers) {
    if (await insertSignal(admin, context.userId, companyId, offerSignal(offer, romeToSignal))) added++
  }

  stats.signalsAdded += added
  // Offres déjà connues lors d'un passage précédent : rien de nouveau
  const alreadyKnown = group.offers.length - added
  for (let i = 0; i < alreadyKnown; i++) skip(stats, 'Offre déjà enregistrée')
}

function offerSignal(offer: JobOffer, romeToSignal: Map<string, string>) {
  return {
    type: (offer.romeCode && romeToSignal.get(offer.romeCode)) || 'job_posting_dev',
    dedupeKey: `francetravail:${offer.id}`,
    sourceUrl: offerUrl(offer),
    evidence: {
      source: 'france_travail',
      offre_id: offer.id,
      intitule: offer.intitule ?? null,
      type_contrat: offer.typeContratLibelle ?? offer.typeContrat ?? null,
      lieu: offer.lieuTravail?.libelle ?? null,
      date_publication: offer.dateCreation ?? null,
      metier: offer.romeLibelle ?? null,
    },
  }
}

// « 69 - LYON 03 » → « Lyon 03 »
function cityFromLabel(label: string | undefined): string | null {
  const city = label?.replace(/^\s*\d{2,3}\s*-\s*/, '').trim()
  return city ? toTitleCase(city) : null
}
