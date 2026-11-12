type Target = { id: string; label: string; dimension: 'sector' | 'strategy' }
type Group = Target & { available: number; found: number; contacted: number; successes: number[] }
type Evidence = { successes: number; contacted: number; low: number; high: number }
export type Suggestion = {
  id: string
  title: string
  label: string
} & (
  | { kind: 'compare'; metric: string; group: Evidence; others: Evidence }
  | { kind: 'explore'; available: number; found: number; contacted: number }
)

const outcomes = [
  { step: 3, label: 'réponses' },
  { step: 4, label: 'rendez-vous' },
  { step: 6, label: 'clients gagnés' },
]

function evidence(successes: number, contacted: number): Evidence {
  const p = successes / contacted
  const z = 1.96
  const divisor = 1 + z ** 2 / contacted
  const center = p + z ** 2 / (2 * contacted)
  const margin = z * Math.sqrt(p * (1 - p) / contacted + z ** 2 / (4 * contacted ** 2))
  return { successes, contacted, low: Math.max(0, (center - margin) / divisor), high: Math.min(1, (center + margin) / divisor) }
}

export function recommend(
  companies: { step: number; available: boolean; targets: Target[] }[],
  minContacts: number,
): Suggestion[] {
  const groups = new Map<string, Group>()
  for (const { step, targets, available } of companies) {
    for (const target of targets) {
      const key = target.dimension + '/' + target.id
      const group = groups.get(key) ?? { ...target, available: 0, found: 0, contacted: 0, successes: [0, 0, 0] }
      group.found++
      if (step >= 2) group.contacted++
      else if (available) group.available++
      outcomes.forEach(({ step: threshold }, i) => {
        if (step >= threshold) group.successes[i] = group.successes[i]! + 1
      })
      groups.set(key, group)
    }
  }

  const suggestions: Suggestion[] = []
  for (const dimension of ['sector', 'strategy'] as const) {
    const peers = [...groups.values()].filter(g => g.dimension === dimension)
    const total = peers.reduce((sum, g) => sum + g.contacted, 0)
    const noun = dimension === 'sector' ? 'secteur' : 'recherche'
    outcomes.forEach(({ label }, i) => {
      const successes = peers.reduce((sum, g) => sum + g.successes[i]!, 0)
      const candidates = peers.filter(g => g.contacted >= minContacts && total - g.contacted >= minContacts)
        .map(g => ({
          g,
          group: evidence(g.successes[i]!, g.contacted),
          others: evidence(successes - g.successes[i]!, total - g.contacted),
        }))
        .filter(c => c.group.low > c.others.high)
        .sort((a, b) => (b.group.low - b.others.high) - (a.group.low - a.others.high) || a.g.id.localeCompare(b.g.id))
      const best = candidates[0]
      if (best) suggestions.push({
        kind: 'compare', id: [dimension, best.g.id, i].join('/'), label: best.g.label,
        title: 'Privilégier ' + (noun === 'secteur' ? 'ce secteur' : 'cette recherche') + ' pour obtenir plus de ' + label,
        metric: label, group: best.group, others: best.others,
      })
    })
  }
  // Parmi les secteurs encore peu testés, privilégier celui qui a le plus de cibles disponibles.
  const unexplored = [...groups.values()].filter(g =>
    g.dimension === 'sector' && g.contacted < minContacts && g.available > 0)
    .sort((a, b) => b.available - a.available || a.id.localeCompare(b.id))[0]
  if (unexplored) suggestions.push({
    kind: 'explore', id: 'explore/' + unexplored.id, title: 'Tester de nouvelles cibles dans ce secteur',
    label: unexplored.label, available: unexplored.available, found: unexplored.found, contacted: unexplored.contacted,
  })
  return suggestions
}
