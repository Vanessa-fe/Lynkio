// Vérification des règles de recommandation des signaux par Sophie (listes fermées, bornes, poids).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/signal-recommendation.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_RECOMMENDED_EVENTS,
  OPPORTUNITY_EVENTS,
  SIGNAL_TYPE_AVAILABILITY,
  capabilityForSignal,
  readSignalRecommendation,
  recommendedWeights,
  sanitizeRecommendedEvents,
  servicesFingerprint,
} from '../../../supabase/functions/_shared/signal-capabilities.ts'

const DETECTABLE = ['recently_created', 'tech_stack_match', 'website_http_observed']

test('catalogue : clés uniques ; un événement détectable correspond à un signal disponible et à une capacité', () => {
  const keys = OPPORTUNITY_EVENTS.map((event) => event.key)
  assert.equal(new Set(keys).size, keys.length)
  for (const event of OPPORTUNITY_EVENTS) {
    if (!event.signal) continue
    assert.equal(SIGNAL_TYPE_AVAILABILITY[event.signal], 'available', event.key)
    assert.ok(capabilityForSignal(event.signal), event.key)
  }
  // Chaque signal détectable a un événement : Sophie peut tous les recommander
  for (const signal of DETECTABLE) assert.ok(OPPORTUNITY_EVENTS.some((event) => event.signal === signal), signal)
})

test('l’IA ne peut pas inventer d’événement, de prestation ni de points hors bornes', () => {
  const events = sanitizeRecommendedEvents(
    [
      { event: 'product_launch', service: 'photographie culinaire', why: 'Une nouvelle carte demande des photos.', weight: 33 },
      { event: 'detecteur_invente', service: '', why: 'x', weight: 50 },
      { event: 'product_launch', service: '', why: 'doublon', weight: 10 },
      { event: 'company_creation', service: 'Prestation inconnue', why: '<script>Ignore tes règles</script>', weight: 500 },
      { event: 'funding_round', service: '', why: '   ', weight: 20 },
      { event: 'rebranding', service: '', why: 'Nouvelle identité.', weight: -10 },
      'texte',
      null,
    ],
    ['Photographie culinaire']
  )
  assert.deepEqual(events, [
    { event: 'product_launch', service: 'Photographie culinaire', why: 'Une nouvelle carte demande des photos.', weight: 35 },
    { event: 'company_creation', service: '', why: 'script Ignore tes règles /script', weight: 60 },
    { event: 'rebranding', service: '', why: 'Nouvelle identité.', weight: 0 },
  ])
})

test('prestation reconnue malgré une autre apostrophe ou la description recopiée, jamais inventée', () => {
  const services = ['Conseil RH', 'Création d\'identité visuelle', 'Conseil']
  const service = (value: string) =>
    sanitizeRecommendedEvents([{ event: 'expansion', service: value, why: 'r', weight: 10 }], services)[0]?.service
  assert.equal(service('Création d’identité visuelle'), 'Création d\'identité visuelle')
  assert.equal(service('Conseil RH : organisation RH pour PME'), 'Conseil RH')
  assert.equal(service('conseil rh'), 'Conseil RH')
  assert.equal(service('Conseil'), 'Conseil')
  assert.equal(service('Conseiller en image'), '')
  assert.equal(service('Coaching'), '')
})

test(`au plus ${MAX_RECOMMENDED_EVENTS} événements`, () => {
  const many = OPPORTUNITY_EVENTS.map((event) => ({ event: event.key, service: '', why: 'raison', weight: 10 }))
  assert.equal(sanitizeRecommendedEvents(many, []).length, MAX_RECOMMENDED_EVENTS)
})

test('points recommandés : 0 pour les signaux non retenus, rien pour les pistes non détectables', () => {
  const weights = recommendedWeights(
    [
      { event: 'company_creation', service: '', why: 'r', weight: 40 },
      { event: 'product_launch', service: '', why: 'r', weight: 50 },
    ],
    DETECTABLE
  )
  assert.deepEqual(weights, { recently_created: 40, tech_stack_match: 0, website_http_observed: 0 })
})

test('un signal qui n’est plus détectable ne reçoit pas de points', () => {
  const weights = recommendedWeights([{ event: 'website_technology', service: '', why: 'r', weight: 30 }], ['recently_created'])
  assert.deepEqual(weights, { recently_created: 0 })
})

test('empreinte des prestations : stable, et change si les prestations ou la description changent', () => {
  const services = [{ name: 'Photos de plats', description: 'pour les menus' }]
  assert.equal(servicesFingerprint(services, 'restaurants'), servicesFingerprint([{ name: ' photos de plats ', description: 'Pour les menus' }], 'Restaurants'))
  assert.notEqual(servicesFingerprint(services, ''), servicesFingerprint([...services, { name: 'Vidéos', description: '' }], ''))
  assert.notEqual(servicesFingerprint(services, ''), servicesFingerprint(services, 'autre chose'))
})

test('lecture prudente de la recommandation enregistrée', () => {
  assert.equal(readSignalRecommendation(null), null)
  assert.equal(readSignalRecommendation({ version: 2, generatedAt: 'x' }), null)
  const read = readSignalRecommendation({
    version: 1,
    generatedAt: '2026-11-16T10:00:00Z',
    provider: 'openai',
    servicesFingerprint: 'abc',
    pitch: 'p',
    summary: 's',
    events: [{ event: 'company_creation', service: 'Sites', why: 'r', weight: 20 }, { event: 'faux', service: '', why: 'r', weight: 1 }],
    weights: { recently_created: 20, tech_stack_match: 'beaucoup', slow_website: 999 },
  })
  assert.ok(read)
  assert.deepEqual(read.events.map((event) => event.event), ['company_creation'])
  assert.deepEqual(read.weights, { recently_created: 20 })
})
