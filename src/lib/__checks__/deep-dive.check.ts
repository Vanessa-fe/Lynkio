// Vérification des règles de l'analyse approfondie (preuve, date, confiance, identité, homonymes).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/deep-dive.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_FINDINGS,
  checkIdentity,
  eventDate,
  filterFindings,
  findingDedupeKey,
  safeHttpUrl,
  siteDomain,
} from '../../../supabase/functions/_shared/deep-dive.ts'

const TODAY = new Date('2026-11-16T12:00:00Z')
const CONSULTED = new Set(['https://presse.example.fr/ouverture-lyon', 'https://boulangerie-dupont.fr/actus'])
const confirmed = { confirmed: true, explanation: 'SIREN et adresse identiques', officialWebsite: null }

const run = (raw: unknown, identity = confirmed) =>
  filterFindings({
    raw,
    identity,
    serviceNames: ['Photographie culinaire'],
    wasConsulted: (url) => CONSULTED.has(url.replace(/\/$/, '')),
    validityDays: () => 180,
    today: TODAY,
  })

const good = {
  event: 'new_establishment',
  title: 'Ouverture d’une deuxième boutique à Lyon',
  date: '2026-10-02',
  source_url: 'https://presse.example.fr/ouverture-lyon',
  summary: 'La boulangerie ouvre une boutique rue de la République.',
  relevance: 'Une nouvelle boutique peut demander des photos des produits.',
  service: 'Photographie culinaire',
  confidence: 'high',
}

test('un résultat prouvé, daté, récent et sûr est retenu', () => {
  const [finding] = run([good])
  assert.equal(finding?.retained, true)
  assert.equal(finding?.rejection, null)
  assert.equal(finding?.sourceUrl, 'https://presse.example.fr/ouverture-lyon')
  assert.equal(finding?.service, 'Photographie culinaire')
  assert.equal(finding?.eventLabel, 'Ouverture d’un établissement')
})

test('jamais de source inventée : une page non consultée n’est ni retenue ni affichée comme lien', () => {
  const [finding] = run([{ ...good, source_url: 'https://site-invente.fr/article' }])
  assert.equal(finding?.retained, false)
  assert.equal(finding?.sourceUrl, null)
  assert.match(finding?.rejection ?? '', /Source non vérifiée/)
})

test('date inconnue, future ou trop ancienne : non retenu', () => {
  assert.match(run([{ ...good, date: '' }])[0]?.rejection ?? '', /Date/)
  assert.match(run([{ ...good, date: '2027-01-10' }])[0]?.rejection ?? '', /Date/)
  assert.match(run([{ ...good, date: '2025-01-10' }])[0]?.rejection ?? '', /ancien/)
})

test('confiance faible ou identité non confirmée : non retenu', () => {
  assert.match(run([{ ...good, confidence: 'low' }])[0]?.rejection ?? '', /Confiance/)
  assert.match(run([{ ...good, confidence: 'inconnue' }])[0]?.rejection ?? '', /Confiance/)
  const unsure = { confirmed: false, explanation: 'Deux sociétés portent ce nom', officialWebsite: null }
  assert.match(run([good], unsure)[0]?.rejection ?? '', /Identité/)
})

test('événements hors liste, automatiques, doublons et entrées invalides sont ignorés', () => {
  const findings = run([
    good,
    { ...good },
    { ...good, event: 'company_creation' },
    { ...good, event: 'recrute_un_dev' },
    { ...good, title: '' },
    'texte',
    null,
  ])
  assert.equal(findings.length, 1)
})

test(`au plus ${MAX_FINDINGS} résultats`, () => {
  const many = Array.from({ length: 15 }, (_, index) => ({ ...good, title: `Annonce ${index}`, source_url: `https://presse.example.fr/a${index}` }))
  assert.equal(run(many).length, MAX_FINDINGS)
})

test('identité : un site différent de celui de la fiche signale un homonyme', () => {
  const homonym = checkIdentity(
    { matched: true, explanation: 'Même nom', official_website: 'https://dupont-paris.fr' },
    'boulangerie-dupont.fr'
  )
  assert.equal(homonym.confirmed, false)
  assert.match(homonym.explanation, /homonyme/)
  const same = checkIdentity(
    { matched: true, explanation: 'SIREN identique', official_website: 'https://www.boulangerie-dupont.fr/' },
    'https://boulangerie-dupont.fr'
  )
  assert.equal(same.confirmed, true)
  assert.equal(checkIdentity({ matched: true, explanation: '' }, null).confirmed, false)
  assert.equal(checkIdentity(null, null).confirmed, false)
})

test('adresses : seulement http(s), sans identifiants ; dates au bon format', () => {
  assert.equal(safeHttpUrl('javascript:alert(1)'), null)
  assert.equal(safeHttpUrl('https://user:pass@exemple.fr'), null)
  assert.equal(safeHttpUrl('ftp://exemple.fr'), null)
  assert.equal(siteDomain('www.Exemple.fr'), 'exemple.fr')
  assert.equal(eventDate('2026-09', TODAY), '2026-09-01')
  assert.equal(eventDate('2026-02-30', TODAY), null)
  assert.equal(eventDate('hier', TODAY), null)
})

test('clé de doublon : même page, même clé, quelle que soit la forme de l’adresse', () => {
  const [a] = run([good])
  const [b] = run([{ ...good, source_url: 'https://presse.example.fr/ouverture-lyon/' }])
  assert.ok(a && b)
  assert.equal(findingDedupeKey(a), findingDedupeKey(b))
})
