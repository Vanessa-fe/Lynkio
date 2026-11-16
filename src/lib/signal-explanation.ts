/**
 * Explication d'un signal d'opportunité sur une fiche (étape 6), sans IA :
 *   - constat : le fait, tel que la source le montre (jamais un besoin) ;
 *   - piste : pourquoi ce fait PEUT créer un besoin pour vos prestations (toujours une hypothèse) ;
 *   - prestation : celle à proposer, quand elle est connue.
 * La piste vient, dans l'ordre : de l'analyse approfondie (pour ce signal), de la recommandation de
 * Sophie (pour ce type de signal), sinon d'une phrase prudente propre au type.
 */

export type ExplainableSignal = {
  signal_type: string
  source: string
  evidence: unknown
  event_at: string | null
  detected_at: string
  type?: { label: string } | null
}

export type SignalAdvice = { why: string; service: string }

export type SignalExplanation = {
  fact: string
  lead: string | null
  service: string | null
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « 27 septembre 2026 » (date seule, sans fuseau) */
export function frenchDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return value
  const [, year, month, day] = match
  return `${Number(day)} ${MONTHS[Number(month) - 1] ?? month} ${year}`
}

/** « il y a 3 mois », « il y a 2 semaines », « ce mois-ci » */
export function elapsed(from: string, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 86_400_000))
  if (days < 14) return days <= 1 ? 'il y a quelques jours' : `il y a ${days} jours`
  if (days < 60) return `il y a ${Math.round(days / 7)} semaines`
  const months = Math.round(days / 30)
  return months < 24 ? `il y a ${months} mois` : `il y a ${Math.round(days / 365)} ans`
}

const TECHNOLOGY_NAMES: Record<string, string> = {
  nextjs: 'Next.js',
  react: 'React',
  wordpress: 'WordPress',
  webflow: 'Webflow',
}

// Pistes prudentes par défaut, quand ni Sophie ni l'analyse approfondie n'en donnent
const DEFAULT_LEADS: Record<string, string> = {
  recently_created: 'Une entreprise qui démarre a souvent beaucoup à mettre en place : c’est un moment où elle peut chercher des prestataires.',
  tech_stack_match: 'Vous maîtrisez cette technologie : vous pourriez faire évoluer son site sans repartir de zéro.',
  website_http_observed: 'Un site non sécurisé peut être une occasion de proposer une mise à jour, à aborder avec tact.',
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function explainSignal(
  signal: ExplainableSignal,
  advice: SignalAdvice | null,
  now: Date = new Date()
): SignalExplanation {
  const evidence = (signal.evidence && typeof signal.evidence === 'object' ? signal.evidence : {}) as Record<string, unknown>
  const label = signal.type?.label ?? signal.signal_type
  const eventDate = signal.event_at ?? null

  let fact: string
  if (signal.source === 'ai_research' && text(evidence.title)) {
    const date = text(evidence.date_publication) || eventDate
    fact = `${text(evidence.title)}${date ? `, annoncé le ${frenchDate(date)}` : ''}.`
  } else if (signal.signal_type === 'recently_created') {
    const date = eventDate ?? text(evidence.date_parution) ?? null
    fact = date
      ? `Cette entreprise a été créée ${elapsed(date, now)} (annonce légale du ${frenchDate(date)}).`
      : 'Cette entreprise a été créée il y a moins d’un an (annonce légale).'
  } else if (signal.signal_type === 'tech_stack_match') {
    const technologies = Array.isArray(evidence.technologies)
      ? evidence.technologies.map((item) => TECHNOLOGY_NAMES[String(item)] ?? String(item))
      : []
    fact = technologies.length > 0
      ? `Son site est fait avec ${technologies.join(', ')}, d’après son analyse du ${frenchDate(signal.detected_at)}.`
      : `Son site utilise une technologie que vous avez choisie, d’après son analyse du ${frenchDate(signal.detected_at)}.`
  } else if (signal.signal_type === 'website_http_observed') {
    fact = `Sa page d’accueil répondait encore en HTTP, sans connexion sécurisée, le ${frenchDate(signal.detected_at)}.`
  } else {
    fact = `${label}${eventDate ? `, le ${frenchDate(eventDate)}` : ''}.`
  }

  const lead = text(evidence.relevance) || advice?.why || DEFAULT_LEADS[signal.signal_type] || null
  const service = text(evidence.service) || advice?.service || null
  return { fact, lead, service: service || null }
}
