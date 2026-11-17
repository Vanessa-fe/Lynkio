import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeRunOutcome, ALREADY_KNOWN_REASON } from '../run-outcome.ts'

test('réussite : nombre réel d’entreprises ajoutées et déjà connues', () => {
  const outcome = describeRunOutcome({
    status: 'succeeded',
    companies_created: 12,
    error: null,
    details: { skip_reasons: { [ALREADY_KNOWN_REASON]: 3, 'Secteur exclu': 5 }, sources: { profile_search: { error: null } } },
  })
  assert.equal(outcome.kind, 'success')
  assert.equal(outcome.created, 12)
  assert.ok(outcome.lines[0]!.startsWith('12 nouvelles entreprises ajoutées'))
  assert.ok(outcome.lines[1]!.startsWith('3 entreprises trouvées étaient déjà'))
})

test('une source en échec : jamais présenté comme une réussite complète', () => {
  const outcome = describeRunOutcome({
    status: 'succeeded',
    companies_created: 4,
    error: 'Le registre n’a pas répondu',
    details: { sources: { profile_search: { error: null }, recent_creations: { error: 'Le registre n’a pas répondu' } } },
  })
  assert.equal(outcome.kind, 'partial')
  assert.equal(outcome.created, 4)
  assert.ok(outcome.lines.some((line) => line.includes('Créations récentes : Le registre')))
})

test('aucune nouvelle entreprise', () => {
  const outcome = describeRunOutcome({
    status: 'succeeded',
    companies_created: 0,
    error: null,
    details: { skip_reasons: { [ALREADY_KNOWN_REASON]: 1 } },
  })
  assert.equal(outcome.kind, 'empty')
  assert.ok(outcome.lines[0]!.startsWith('1 entreprise trouvée était déjà'))
})

test('recherche interrompue ou en erreur', () => {
  const outcome = describeRunOutcome({ status: 'failed', companies_created: 0, error: 'Passage interrompu avant la fin', details: {} })
  assert.equal(outcome.kind, 'failed')
  assert.equal(outcome.lines[0], 'Passage interrompu avant la fin')
  assert.equal(outcome.created, 0)
})

test('détails absents ou mal formés (anciens passages)', () => {
  assert.equal(describeRunOutcome({ status: 'succeeded', companies_created: 2, error: null, details: null }).kind, 'success')
  assert.equal(describeRunOutcome({ status: 'running', companies_created: 0, error: null, details: [] }).kind, 'running')
})
