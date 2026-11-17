/**
 * Accueil de Sophie sur le tableau de bord (lot 1.5) : une phrase et au plus trois suggestions, tirées
 * de RÈGLES métier sur des chiffres réels, sans IA (décision du 17/11/2026 : les suggestions simples
 * viennent de règles déterministes). Rien à signaler : pas de suggestion artificielle.
 */

export type DashboardFacts = {
  overdueReminders: number
  // Relances du jour, pas encore en retard
  todayReminders: number
  // Découvertes ajoutées ces 7 derniers jours (ni en démarche, ni écartées)
  newDiscoveries: number
  unreadAlerts: number
  // Dernière recherche : échouée ou non
  lastRunFailed: boolean
}

export type Suggestion = { key: string; label: string; href: string }

export type Welcome = { summary: string; suggestions: Suggestion[] }

const MAX_SUGGESTIONS = 3

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

export function dashboardWelcome(facts: DashboardFacts): Welcome {
  const parts: string[] = []
  const reminders = facts.overdueReminders + facts.todayReminders
  if (facts.newDiscoveries > 0) {
    parts.push(plural(facts.newDiscoveries, 'nouvelle entreprise à examiner', 'nouvelles entreprises à examiner'))
  }
  if (reminders > 0) {
    parts.push(
      facts.overdueReminders > 0
        ? `${plural(reminders, 'relance', 'relances')} à faire, dont ${facts.overdueReminders} en retard`
        : `${plural(reminders, 'relance prévue', 'relances prévues')} aujourd’hui`
    )
  }

  const summary =
    parts.length === 0
      ? 'Rien d’urgent aujourd’hui.'
      : `Vous avez ${parts.join(' et ')}.${parts.length > 1 ? ' Par quoi voulez-vous commencer ?' : ''}`

  // Ordre : ce qui ne peut pas attendre, puis le travail du jour, puis les nouveautés
  const suggestions: Suggestion[] = []
  if (facts.overdueReminders > 0) {
    suggestions.push({
      key: 'overdue',
      label: `Traiter ${plural(facts.overdueReminders, 'relance en retard', 'relances en retard')}`,
      href: '/reminders',
    })
  } else if (facts.todayReminders > 0) {
    suggestions.push({
      key: 'today',
      label: `Voir ${facts.todayReminders > 1 ? `les ${facts.todayReminders} relances` : 'la relance'} du jour`,
      href: '/reminders',
    })
  }
  if (facts.newDiscoveries > 0) {
    suggestions.push({
      key: 'discoveries',
      label: `Examiner ${facts.newDiscoveries > 1 ? `les ${facts.newDiscoveries} nouvelles entreprises` : 'la nouvelle entreprise'}`,
      href: '/companies?vue=tableau',
    })
  }
  if (facts.lastRunFailed) {
    suggestions.push({ key: 'run-failed', label: 'Voir pourquoi la dernière recherche n’a pas abouti', href: '/prospection' })
  }
  if (facts.unreadAlerts > 0) {
    suggestions.push({
      key: 'alerts',
      label: `Lire ${plural(facts.unreadAlerts, 'nouvelle alerte', 'nouvelles alertes')}`,
      href: '/notifications',
    })
  }

  return { summary, suggestions: suggestions.slice(0, MAX_SUGGESTIONS) }
}
