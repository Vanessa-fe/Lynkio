// Vérification des explications de signaux sur la fiche (constat, piste, prestation).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/signal-explanation.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { elapsed, explainSignal, frenchDate } from '../signal-explanation.ts'

const NOW = new Date('2026-11-16T12:00:00Z')

test('création récente : un constat daté, une piste prudente', () => {
  const explanation = explainSignal(
    { signal_type: 'recently_created', source: 'bodacc', evidence: {}, event_at: '2026-08-10T00:00:00Z', detected_at: '2026-08-12', type: { label: 'Entreprise créée récemment' } },
    null,
    NOW
  )
  assert.equal(explanation.fact, 'Cette entreprise a été créée il y a 3 mois (annonce légale du 10 août 2026).')
  assert.match(explanation.lead ?? '', /souvent/)
  assert.equal(explanation.service, null)
})

test('la piste de Sophie et sa prestation remplacent la phrase par défaut', () => {
  const explanation = explainSignal(
    { signal_type: 'recently_created', source: 'bodacc', evidence: {}, event_at: '2026-08-10', detected_at: '2026-08-12' },
    { why: 'Une entreprise récente peut vouloir un premier site.', service: 'Site vitrine' },
    NOW
  )
  assert.equal(explanation.lead, 'Une entreprise récente peut vouloir un premier site.')
  assert.equal(explanation.service, 'Site vitrine')
})

test('analyse approfondie : l’événement annoncé, sa piste et sa prestation', () => {
  const explanation = explainSignal(
    {
      signal_type: 'product_launch',
      source: 'ai_research',
      evidence: { title: 'Lancement d’une gamme de bocaux', date_publication: '2026-10-02', relevance: 'Une gamme nouvelle peut demander des photos.', service: 'Photo culinaire' },
      event_at: '2026-10-02',
      detected_at: '2026-11-16',
    },
    { why: 'autre piste', service: 'autre' },
    NOW
  )
  assert.equal(explanation.fact, 'Lancement d’une gamme de bocaux, annoncé le 2 octobre 2026.')
  assert.equal(explanation.lead, 'Une gamme nouvelle peut demander des photos.')
  assert.equal(explanation.service, 'Photo culinaire')
})

test('stack compatible : les technologies nommées', () => {
  const explanation = explainSignal(
    { signal_type: 'tech_stack_match', source: 'site', evidence: { technologies: ['nextjs', 'react'] }, event_at: null, detected_at: '2026-09-29T10:00:00Z' },
    null,
    NOW
  )
  assert.equal(explanation.fact, 'Son site est fait avec Next.js, React, d’après son analyse du 29 septembre 2026.')
})

test('un type sans phrase connue reste sobre, sans piste inventée', () => {
  const explanation = explainSignal(
    { signal_type: 'expansion', source: 'site', evidence: {}, event_at: null, detected_at: '2026-11-01', type: { label: 'Développement annoncé' } },
    null,
    NOW
  )
  assert.equal(explanation.fact, 'Développement annoncé.')
  assert.equal(explanation.lead, null)
})

test('dates en français et durées', () => {
  assert.equal(frenchDate('2026-01-05'), '5 janvier 2026')
  assert.equal(elapsed('2026-11-15', NOW), 'il y a quelques jours')
  assert.equal(elapsed('2026-10-20', NOW), 'il y a 4 semaines')
  assert.equal(elapsed('2023-11-01', NOW), 'il y a 3 ans')
})
