import { test } from 'node:test'
import assert from 'node:assert/strict'
import { recommend } from '../prospect-recommendations.ts'

function cohort(id: string, step: number, count: number, available = true) {
  return Array.from({ length: count }, () => ({
    step, available, targets: [
      { dimension: 'sector' as const, id, label: id },
      { dimension: 'strategy' as const, id, label: id },
    ],
  }))
}

test('chaque indicateur compare les contactées aux autres groupes de même dimension', () => {
  const rows = [...cohort('A', 6, 30), ...cohort('B', 2, 30), ...cohort('B', 0, 10)]
  const comparisons = recommend(rows, 30).filter(item => item.kind === 'compare')
  assert.equal(comparisons.length, 6)
  for (const item of comparisons) {
    assert.equal(item.label, 'A')
    assert.equal(item.group.successes, 30)
    assert.equal(item.others.contacted, 30)
    assert.equal(item.others.successes, 0)
    assert.ok(Math.abs(item.group.low - 0.8865) < 0.001)
    assert.ok(item.group.low > item.others.high)
  }
})

test('aucun classement pour une référence trop petite ou des intervalles qui se chevauchent', () => {
  assert.deepEqual(recommend([...cohort('A', 6, 30), ...cohort('B', 2, 29)], 30), [])
  assert.deepEqual(recommend([...cohort('A', 6, 30), ...cohort('B', 6, 30)], 30), [])
  assert.deepEqual(recommend([], 30), [])
})

test('exploration limitée aux cibles ouvertes encore sans contact', () => {
  const items = recommend([...cohort('A', 2, 2), ...cohort('A', 0, 5), ...cohort('B', 0, 60, false)], 30)
  assert.deepEqual(items.map(i => i.kind === 'explore' && [i.label, i.available, i.contacted]), [['A', 5, 2]])
})

test('un avantage sur les réponses ne promet ni rendez-vous ni clients', () => {
  const items = recommend([...cohort('A', 3, 30), ...cohort('B', 2, 30)], 30)
  assert.deepEqual(items.map(i => i.kind === 'compare' && i.metric), ['réponses', 'réponses'])
})
