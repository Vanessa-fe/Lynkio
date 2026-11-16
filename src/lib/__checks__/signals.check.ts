// Vérification du catalogue de signaux dans les réglages (disponibilité, état, conservation des réglages).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/signals.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  groupSignalsForSettings,
  hasSignalProof,
  mergeSignalWeights,
  signalAvailability,
  signalState,
  type SignalAvailability,
} from '../constants/signals.ts'

const signal = (key: string, availability: SignalAvailability, isSuggested: boolean) => ({
  key,
  availability,
  isSuggested,
})

test('une disponibilité inconnue est traitée comme indisponible (jamais comme détectable)', () => {
  assert.equal(signalAvailability('available'), 'available')
  assert.equal(signalAvailability('retired'), 'retired')
  assert.equal(signalAvailability(null), 'unavailable')
  assert.equal(signalAvailability('autre'), 'unavailable')
})

test('les signaux retirés disparaissent, les indisponibles sont à part', () => {
  const groups = groupSignalsForSettings([
    signal('recently_created', 'available', true),
    signal('tech_stack_match', 'available', false),
    signal('funding_round', 'unavailable', true),
    signal('job_posting_dev', 'retired', true),
  ])
  assert.deepEqual(groups.suggested.map((s) => s.key), ['recently_created'])
  assert.deepEqual(groups.other.map((s) => s.key), ['tech_stack_match'])
  assert.deepEqual(groups.unavailable.map((s) => s.key), ['funding_round'])
  const all = [...groups.suggested, ...groups.other, ...groups.unavailable].map((s) => s.key)
  assert.ok(!all.includes('job_posting_dev'))
})

test('preuve : source officielle ou adresse de la page, sinon aucun point', () => {
  assert.equal(hasSignalProof({ source: 'bodacc', source_url: null }), true)
  assert.equal(hasSignalProof({ source: 'registry', source_url: null }), true)
  assert.equal(hasSignalProof({ source: 'site', source_url: 'https://exemple.fr/' }), true)
  assert.equal(hasSignalProof({ source: 'site', source_url: null }), false)
  assert.equal(hasSignalProof({ source: 'ai_research', source_url: null }), false)
  assert.equal(hasSignalProof({ source: 'unknown', source_url: null }), false)
})

test('état : actif avec des points, inactif à 0, indisponible sans détecteur', () => {
  assert.equal(signalState('available', 20), 'active')
  assert.equal(signalState('available', 0), 'inactive')
  assert.equal(signalState('unavailable', 45), 'unavailable')
  assert.equal(signalState('retired', 30), 'unavailable')
})

test('enregistrer garde les réglages des signaux absents du formulaire', () => {
  const defaults = new Map([
    ['recently_created', 10],
    ['tech_stack_match', 10],
  ])
  const merged = mergeSignalWeights(
    { job_posting_dev: 50, recently_created: 25, bad: 'x' },
    { recently_created: 10, tech_stack_match: 30 },
    defaults
  )
  // job_posting_dev (retiré, absent du formulaire) est conservé ; recently_created revient au défaut ;
  // une valeur invalide n'est pas recopiée
  assert.deepEqual(merged, { job_posting_dev: 50, tech_stack_match: 30 })
})

test('sans réglage existant, seuls les écarts au défaut sont enregistrés', () => {
  assert.deepEqual(mergeSignalWeights(null, { a: 0, b: 5 }, new Map([['b', 5]])), {})
})
