/**
 * Suggestions proactives de Sophie (phase 5 de la refonte) : quelques actions concrètes, chacune liée à un
 * cas précis (une relance, un envoi resté sans réponse, un dirigeant, de nouvelles entreprises), tirées de
 * RÈGLES sur les données réelles, sans IA. Rien à signaler : aucune suggestion artificielle.
 *
 * Chaque clé désigne le cas : « Ignorer » l'écarte pour de bon, et un nouveau cas (un nouvel envoi, une
 * nouvelle relance, de nouvelles entreprises) redonne une nouvelle suggestion.
 */

export type SuggestionKind = 'reminder' | 'no_reply' | 'decision_maker' | 'discoveries'

export type SophieSuggestion = {
  key: string
  kind: SuggestionKind
  label: string
  detail: string
  href: string
}

export type SuggestionFacts = {
  // Relances non faites, dues aujourd'hui ou avant (les plus anciennes d'abord)
  dueReminders: { id: string; title: string; dueAt: string; companyId: string | null; companyName: string | null }[]
  // Entreprises en démarche dont le dernier échange est un envoi resté sans réponse, sans relance prévue
  unanswered: {
    interactionId: string
    companyId: string
    companyName: string
    type: string
    occurredAt: string
  }[]
  // Dirigeants d'entreprises en démarche à qui rien n'a encore été envoyé
  uncontactedDecisionMakers: {
    contactId: string
    companyId: string
    companyName: string
    name: string
    role: string | null
  }[]
  // Découvertes des 7 derniers jours (les mieux notées d'abord)
  newDiscoveries: { id: string; name: string; score: number | null; createdAt: string }[]
}

export type SophieWelcome = { summary: string; suggestions: SophieSuggestion[] }

export const MAX_SOPHIE_SUGGESTIONS = 4
// Un envoi devient « sans réponse » après ce délai
export const NO_REPLY_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

const SENT_LABELS: Record<string, string> = {
  email: 'votre e-mail',
  linkedin_message: 'votre message LinkedIn',
  call: 'votre appel',
  meeting: 'votre rendez-vous',
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

/** Jours calendaires (heure de Paris) entre deux dates */
function parisDay(date: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(date)
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((Date.parse(parisDay(to)) - Date.parse(parisDay(from))) / DAY_MS)
}

function formatDay(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

export function buildSophieWelcome(facts: SuggestionFacts, options: { now: Date; dismissed: Set<string> }): SophieWelcome {
  const { now, dismissed } = options
  const all: SophieSuggestion[] = []

  // 1. Relances prévues : ce qui ne peut pas attendre
  for (const reminder of facts.dueReminders) {
    const due = new Date(reminder.dueAt)
    const late = daysBetween(due, now)
    all.push({
      key: `reminder:${reminder.id}`,
      kind: 'reminder',
      label: reminder.companyName ? `Relancer ${reminder.companyName}` : reminder.title,
      detail:
        late <= 0
          ? 'Relance prévue aujourd’hui'
          : `Relance prévue ${late === 1 ? 'hier' : `le ${formatDay(due)}`} (en retard)`,
      href: reminder.companyId ? `/companies/${reminder.companyId}` : '/reminders',
    })
  }

  // 2. Envois restés sans réponse depuis au moins 7 jours, sans relance prévue
  for (const item of facts.unanswered) {
    const days = daysBetween(new Date(item.occurredAt), now)
    if (days < NO_REPLY_DAYS) continue
    all.push({
      key: `no-reply:${item.interactionId}`,
      kind: 'no_reply',
      label: `Relancer ${item.companyName}`,
      detail: `Pas de réponse à ${SENT_LABELS[item.type] ?? 'votre message'} depuis ${days} jours`,
      href: `/companies/${item.companyId}`,
    })
  }

  // 3. Dirigeant connu, pas encore contacté (un seul par entreprise)
  const seenCompanies = new Set<string>()
  for (const contact of facts.uncontactedDecisionMakers) {
    if (seenCompanies.has(contact.companyId)) continue
    seenCompanies.add(contact.companyId)
    all.push({
      key: `decision-maker:${contact.contactId}`,
      kind: 'decision_maker',
      label: `Contacter ${contact.name}`,
      detail: `${contact.role ? `${contact.role} chez` : 'Dirigeant de'} ${contact.companyName} : rien ne lui a encore été envoyé`,
      href: `/companies/${contact.companyId}`,
    })
  }

  // 4. Nouvelles entreprises : une suggestion pour le lot, qui revient quand il en arrive de nouvelles
  if (facts.newDiscoveries.length > 0) {
    const latest = facts.newDiscoveries.reduce((max, company) => (company.createdAt > max ? company.createdAt : max), '')
    const best = facts.newDiscoveries[0]!
    const count = facts.newDiscoveries.length
    all.push({
      key: `discoveries:${latest.slice(0, 19)}`,
      kind: 'discoveries',
      label: count > 1 ? `Examiner les ${count} découvertes de la semaine` : `Examiner ${best.name}`,
      detail:
        count > 1
          ? `La mieux notée : ${best.name}${best.score !== null ? ` (${best.score}/100)` : ''}`
          : `Trouvée cette semaine${best.score !== null ? `, compatibilité ${best.score}/100` : ''}`,
      href: count > 1 ? '/companies?vue=tableau' : `/companies/${best.id}`,
    })
  }

  const visible = all.filter((suggestion) => !dismissed.has(suggestion.key))
  const suggestions = visible.slice(0, MAX_SOPHIE_SUGGESTIONS)

  const reminders = visible.filter((suggestion) => suggestion.kind === 'reminder').length
  const followUps = visible.filter((suggestion) => suggestion.kind === 'no_reply').length
  const parts: string[] = []
  if (reminders > 0) parts.push(plural(reminders, 'relance prévue', 'relances prévues'))
  if (followUps > 0) parts.push(plural(followUps, 'prospect sans réponse', 'prospects sans réponse'))
  const summary =
    suggestions.length === 0
      ? 'Rien d’urgent pour le moment.'
      : parts.length > 0
        ? `Vous avez ${parts.join(' et ')}. Voici ce que je vous propose :`
        : 'Voici ce que je vous propose :'

  return { summary, suggestions }
}
