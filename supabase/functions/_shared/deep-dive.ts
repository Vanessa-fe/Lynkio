// Règles de l'analyse approfondie (« Approfondir avec Sophie », étape 5), sans IA ni réseau : elles
// décident quels résultats de la recherche web deviennent des signaux. Testées dans
// src/lib/__checks__/deep-dive.check.ts.
//
// Un résultat n'est retenu que si :
//   - son événement fait partie de ceux que seule l'analyse approfondie repère (liste fermée) ;
//   - sa page a VRAIMENT été consultée par la recherche (jamais une adresse inventée) ;
//   - sa date est connue, passée, et assez récente (durée de validité du signal) ;
//   - la confiance de l'IA n'est pas faible ;
//   - l'identité de l'entreprise est confirmée (pas d'homonyme).
// Les autres restent visibles, avec la raison de leur rejet, et ne rapportent aucun point.

import { deepResearchEvents, matchService, opportunityEvent } from './signal-capabilities.ts'

export const MAX_FINDINGS = 10
/** Durée de validité par défaut (jours) d'un événement trouvé : celle des types créés en 00069 */
export const DEFAULT_EVENT_VALIDITY_DAYS = 180

export type Confidence = 'high' | 'medium' | 'low'

export type DeepFinding = {
  event: string
  eventLabel: string
  title: string
  /** AAAA-MM-JJ (un mois seul devient le 1er du mois), null si inconnue */
  date: string | null
  /** Adresse de la source ; affichée comme lien seulement si elle a été consultée */
  sourceUrl: string | null
  sourceVerified: boolean
  summary: string
  /** Pourquoi c'est une opportunité pour les prestations (hypothèse) */
  relevance: string
  service: string
  confidence: Confidence
  retained: boolean
  /** Raison du rejet, null si retenu */
  rejection: string | null
}

export type DeepDiveIdentity = {
  confirmed: boolean
  explanation: string
  officialWebsite: string | null
}

export type DeepDiveResult = {
  version: 1
  identity: DeepDiveIdentity
  summary: string
  findings: DeepFinding[]
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''
}

/** Adresse web publique (http/https) bien formée, sinon null */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 2000) return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

/** Domaine sans « www. », en minuscules */
export function siteDomain(value: string | null | undefined): string | null {
  const url = safeHttpUrl(value && !/^https?:\/\//i.test(value) ? `https://${value}` : value)
  return url ? new URL(url).hostname.toLowerCase().replace(/^www\./, '') : null
}

/** Date d'un événement : AAAA-MM-JJ ou AAAA-MM, jamais dans le futur */
export function eventDate(value: unknown, today: Date): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(`${year}-${month}-${day ?? '01'}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.getUTCMonth() + 1 !== Number(month)) return null
  if (date.getTime() > today.getTime()) return null
  return date.toISOString().slice(0, 10)
}

/**
 * Identité : l'IA doit l'avoir confirmée (SIREN, adresse, site), et le site qu'elle donne doit être
 * celui de la fiche quand la fiche en a un. Sinon, rien n'est retenu (homonyme possible).
 */
export function checkIdentity(raw: unknown, companyWebsite: string | null): DeepDiveIdentity {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const officialWebsite = safeHttpUrl(value.official_website)
  const explanation = clean(value.explanation, 300)
  const claimed = value.matched === true && explanation.length > 0
  const known = siteDomain(companyWebsite)
  const found = siteDomain(officialWebsite)
  if (claimed && known && found && known !== found) {
    return {
      confirmed: false,
      explanation: `Le site trouvé (${found}) n’est pas celui de la fiche (${known}) : homonyme possible.`,
      officialWebsite,
    }
  }
  return {
    confirmed: claimed,
    explanation: explanation || 'Votre IA n’a pas pu confirmer qu’il s’agit bien de cette entreprise.',
    officialWebsite,
  }
}

/**
 * Filtre les résultats de l'IA. wasConsulted dit si une adresse a vraiment été ouverte par la recherche
 * (pages renvoyées par le fournisseur) ; validityDays donne la durée de validité de chaque type.
 */
export function filterFindings(options: {
  raw: unknown
  identity: DeepDiveIdentity
  serviceNames: string[]
  wasConsulted: (url: string) => boolean
  validityDays: (signalType: string) => number
  today: Date
}): DeepFinding[] {
  const allowed = new Set(deepResearchEvents().map((event) => event.key))
  const items = Array.isArray(options.raw) ? options.raw : []
  const seen = new Set<string>()
  const findings: DeepFinding[] = []

  for (const item of items) {
    if (findings.length >= MAX_FINDINGS) break
    if (!item || typeof item !== 'object') continue
    const value = item as Record<string, unknown>
    const event = typeof value.event === 'string' ? value.event : ''
    if (!allowed.has(event)) continue
    const title = clean(value.title, 200)
    if (!title) continue

    const url = safeHttpUrl(value.source_url)
    const key = `${event}|${url ?? title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)

    const sourceVerified = !!url && options.wasConsulted(url)
    const date = eventDate(value.date, options.today)
    const confidence: Confidence =
      value.confidence === 'high' || value.confidence === 'medium' ? value.confidence : 'low'
    const signal = opportunityEvent(event)?.signal ?? event
    const maxAgeMs = options.validityDays(signal) * 86_400_000

    let rejection: string | null = null
    if (!options.identity.confirmed) rejection = 'Identité de l’entreprise non confirmée'
    else if (!sourceVerified) rejection = 'Source non vérifiée : la page n’a pas été consultée par la recherche'
    else if (!date) rejection = 'Date de l’événement inconnue'
    else if (options.today.getTime() - new Date(date).getTime() > maxAgeMs) rejection = 'Événement trop ancien'
    else if (confidence === 'low') rejection = 'Confiance trop faible'

    findings.push({
      event,
      eventLabel: opportunityEvent(event)?.label ?? event,
      title,
      date,
      sourceUrl: sourceVerified ? url : null,
      sourceVerified,
      summary: clean(value.summary, 400),
      relevance: clean(value.relevance, 300),
      service: matchService(clean(value.service, 300), options.serviceNames),
      confidence,
      retained: rejection === null,
      rejection,
    })
  }
  return findings
}

/** Clé de doublon d'un signal trouvé : même événement, même page */
export function findingDedupeKey(finding: DeepFinding): string {
  const url = finding.sourceUrl ? new URL(finding.sourceUrl) : null
  const page = url ? `${url.hostname.replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`.toLowerCase() : finding.title
  return `deep:${page}`.slice(0, 300)
}
