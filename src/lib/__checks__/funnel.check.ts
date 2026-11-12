// Vérification de l'entonnoir (dénominateurs, absence de donnée, petits échantillons).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/funnel.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeFunnel, stageSteps, type FunnelStage } from '../funnel.ts'

const stages: FunnelStage[] = [
  { id: 'q', name: 'À qualifier', kind: 'open', role: null, order: 0, is_default: true },
  { id: 'tc', name: 'À contacter', kind: 'open', role: 'to_contact', order: 1, is_default: false },
  { id: 'c', name: 'Contacté', kind: 'open', role: 'contacted', order: 2, is_default: false },
  { id: 'r', name: 'Relancé', kind: 'open', role: 'followed_up', order: 3, is_default: false },
  { id: 'd', name: 'En discussion', kind: 'open', role: 'in_discussion', order: 4, is_default: false },
  { id: 'm', name: 'Rendez-vous', kind: 'open', role: 'meeting', order: 5, is_default: false },
  { id: 'p', name: 'Proposition envoyée', kind: 'open', role: null, order: 6, is_default: false },
  { id: 'w', name: 'Gagné', kind: 'won', role: null, order: 7, is_default: false },
  { id: 'l', name: 'Perdu', kind: 'lost', role: null, order: 8, is_default: false },
  { id: 'x', name: 'Hors cible', kind: 'excluded', role: null, order: 9, is_default: false },
]

test('chaque étape du pipeline a son étape d’entonnoir', () => {
  const steps = stageSteps(stages)
  assert.deepEqual(
    ['q', 'tc', 'c', 'r', 'd', 'm', 'p', 'w', 'l', 'x'].map((id) => steps.get(id)),
    [0, 1, 2, 2, 3, 4, 5, 6, 0, 0]
  )
})

test('aucune fiche : aucun taux (pas « 0 % »)', () => {
  const result = computeFunnel({ companies: [], stages, events: [], interactions: [] })
  assert.equal(result.steps[0]!.count, 0)
  assert.ok(result.rates.every((rate) => rate.rate === null && rate.denominator === 0))
})

test('une fiche gagnée compte pour toutes les étapes d’avant, dénominateurs explicites', () => {
  const result = computeFunnel({
    companies: [
      { id: 'a', stage_id: 'w' },
      { id: 'b', stage_id: 'q' },
      { id: 'c', stage_id: 'q' },
      { id: 'd', stage_id: 'x' },
    ],
    stages,
    events: [],
    interactions: [{ company_id: 'b', type: 'email', direction: 'outgoing', status: 'done' }],
  })
  assert.deepEqual(result.steps.map((step) => step.count), [4, 2, 2, 1, 1, 1, 1])
  const contacted = result.rates.find((rate) => rate.to === 'contacted')!
  assert.equal(contacted.numerator, 2)
  assert.equal(contacted.denominator, 2)
  assert.equal(contacted.rate, 100)
  assert.equal(contacted.small, true)
  assert.equal(result.excluded, 1)
})

test('un brouillon ne compte pas comme un contact ; une fiche perdue garde ce qu’elle a atteint', () => {
  const result = computeFunnel({
    companies: [
      { id: 'a', stage_id: 'q' },
      { id: 'b', stage_id: 'l' },
    ],
    stages,
    events: [{ company_id: 'b', to_stage_id: 'd' }],
    interactions: [{ company_id: 'a', type: 'email', direction: 'outgoing', status: 'draft' }],
  })
  assert.deepEqual(result.steps.map((step) => step.count), [2, 1, 1, 1, 0, 0, 0])
  assert.equal(result.lost, 1)
})

test('les événements d’une autre fiche (hors période) sont ignorés', () => {
  const result = computeFunnel({
    companies: [{ id: 'a', stage_id: 'q' }],
    stages,
    events: [{ company_id: 'zzz', to_stage_id: 'w' }],
    interactions: [],
  })
  assert.equal(result.steps.at(-1)!.count, 0)
})
