/**
 * Résumé de la fin d'une recherche (un passage de pipeline_runs), sans IA, pour la fenêtre qui
 * s'ouvre quand une recherche lancée à la main se termine (lot 1.3 de la refonte).
 *
 * Règle : ne jamais annoncer une réussite complète quand une source a échoué. Un passage dont une
 * source a échoué mais une autre a répondu reste « succeeded » en base, avec un message d'erreur :
 * c'est un résultat partiel.
 */

export type RunForOutcome = {
  status: 'running' | 'succeeded' | 'failed'
  companies_created: number
  error: string | null
  details: unknown
}

export type RunOutcome = {
  kind: 'running' | 'success' | 'partial' | 'empty' | 'failed'
  title: string
  lines: string[]
  // Nouvelles entreprises ajoutées (le bouton « Voir les entreprises » n'apparaît que s'il y en a)
  created: number
}

// Raison notée par les détecteurs quand l'entreprise est déjà dans le portefeuille
export const ALREADY_KNOWN_REASON = 'Déjà dans vos entreprises'

const SOURCE_LABELS: Record<string, string> = {
  job_postings: 'Offres d’emploi',
  recent_creations: 'Créations récentes',
  tech_users: 'Recherche par technologie',
  profile_search: 'Vos recherches',
}

type Details = {
  skip_reasons?: Record<string, number>
  signals_added?: number
  sources?: Record<string, { error?: string | null }>
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count > 1 ? pluralForm : singular}`
}

function readDetails(details: unknown): Details {
  return details && typeof details === 'object' && !Array.isArray(details) ? (details as Details) : {}
}

export function describeRunOutcome(run: RunForOutcome): RunOutcome {
  const details = readDetails(run.details)
  const created = run.companies_created
  const known = details.skip_reasons?.[ALREADY_KNOWN_REASON] ?? 0
  const signalsAdded = details.signals_added ?? 0

  if (run.status === 'running') {
    return { kind: 'running', title: 'Recherche en cours…', lines: [], created: 0 }
  }

  if (run.status === 'failed') {
    return {
      kind: 'failed',
      title: 'La recherche n’a pas abouti',
      lines: [
        run.error ?? 'Erreur inattendue pendant la recherche.',
        'Aucune entreprise n’a été ajoutée. Cette recherche n’est pas comptée dans vos limites.',
      ],
      created: 0,
    }
  }

  const lines: string[] = []
  if (created > 0) {
    lines.push(`${plural(created, 'nouvelle entreprise ajoutée', 'nouvelles entreprises ajoutées')} à votre liste.`)
  }
  if (known > 0) {
    lines.push(
      `${plural(known, 'entreprise trouvée était', 'entreprises trouvées étaient')} déjà dans vos entreprises : ${known > 1 ? 'elles n’ont pas été ajoutées' : 'elle n’a pas été ajoutée'} une deuxième fois.`
    )
  }
  if (signalsAdded > 0) {
    lines.push(`${plural(signalsAdded, 'nouveau signal noté', 'nouveaux signaux notés')} sur des entreprises déjà suivies.`)
  }

  // Une source a échoué, une autre a répondu : résultat partiel, jamais présenté comme complet
  const failedSources = Object.entries(details.sources ?? {}).filter(([, source]) => source?.error)
  if (run.error || failedSources.length > 0) {
    const failures =
      failedSources.length > 0
        ? failedSources.map(([key, source]) => `${SOURCE_LABELS[key] ?? key} : ${source.error}`)
        : [run.error as string]
    return {
      kind: 'partial',
      title: 'Recherche terminée en partie',
      lines: [...(lines.length > 0 ? lines : ['Aucune nouvelle entreprise ajoutée.']), ...failures],
      created,
    }
  }

  if (created === 0) {
    return {
      kind: 'empty',
      title: 'Aucune nouvelle entreprise',
      lines: [
        ...lines,
        'Cette recherche n’est pas comptée dans vos limites. Vous pouvez élargir la zone ou les secteurs de vos recherches.',
      ],
      created: 0,
    }
  }

  return { kind: 'success', title: 'Recherche terminée', lines, created }
}
