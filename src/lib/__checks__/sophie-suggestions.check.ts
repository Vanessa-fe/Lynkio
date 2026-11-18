import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSophieWelcome, type SuggestionFacts } from '../sophie-suggestions.ts'

const now = new Date('2026-11-17T10:00:00Z')
const empty: SuggestionFacts = { dueReminders: [], unanswered: [], uncontactedDecisionMakers: [], newDiscoveries: [] }
const none = new Set<string>()

test('rien à signaler : aucune suggestion artificielle', () => {
  const welcome = buildSophieWelcome(empty, { now, dismissed: none })
  assert.equal(welcome.summary, 'Rien d’urgent pour le moment.')
  assert.deepEqual(welcome.suggestions, [])
})

test('relance du jour puis en retard, avec le nom de l’entreprise', () => {
  const welcome = buildSophieWelcome(
    {
      ...empty,
      dueReminders: [
        { id: 'r1', title: 'Relancer A', dueAt: '2026-11-15T08:00:00Z', companyId: 'c1', companyName: 'ACME' },
        { id: 'r2', title: 'Appeler', dueAt: '2026-11-17T08:00:00Z', companyId: null, companyName: null },
      ],
    },
    { now, dismissed: none }
  )
  assert.equal(welcome.suggestions[0]!.label, 'Relancer ACME')
  assert.match(welcome.suggestions[0]!.detail, /en retard/)
  assert.equal(welcome.suggestions[0]!.href, '/companies/c1')
  assert.equal(welcome.suggestions[1]!.label, 'Appeler')
  assert.equal(welcome.suggestions[1]!.detail, 'Relance prévue aujourd’hui')
  assert.equal(welcome.suggestions[1]!.href, '/reminders')
  assert.equal(welcome.summary, 'Vous avez 2 relances prévues. Voici ce que je vous propose :')
})

test('sans réponse : seulement après 7 jours', () => {
  const welcome = buildSophieWelcome(
    {
      ...empty,
      unanswered: [
        { interactionId: 'i1', companyId: 'c1', companyName: 'ACME', type: 'email', occurredAt: '2026-11-08T09:00:00Z' },
        { interactionId: 'i2', companyId: 'c2', companyName: 'Béta', type: 'email', occurredAt: '2026-11-13T09:00:00Z' },
      ],
    },
    { now, dismissed: none }
  )
  assert.deepEqual(welcome.suggestions.map((suggestion) => suggestion.key), ['no-reply:i1'])
  assert.equal(welcome.suggestions[0]!.detail, 'Pas de réponse à votre e-mail depuis 9 jours')
})

test('un seul dirigeant par entreprise', () => {
  const welcome = buildSophieWelcome(
    {
      ...empty,
      uncontactedDecisionMakers: [
        { contactId: 'p1', companyId: 'c1', companyName: 'ACME', name: 'Marie Durand', role: 'Gérante' },
        { contactId: 'p2', companyId: 'c1', companyName: 'ACME', name: 'Paul Martin', role: null },
      ],
    },
    { now, dismissed: none }
  )
  assert.equal(welcome.suggestions.length, 1)
  assert.equal(welcome.suggestions[0]!.label, 'Contacter Marie Durand')
  assert.equal(welcome.suggestions[0]!.detail, 'Gérante chez ACME : rien ne lui a encore été envoyé')
})

test('nouvelles entreprises : une suggestion dont la clé suit la plus récente', () => {
  const discoveries = [
    { id: 'c1', name: 'ACME', score: 82, createdAt: '2026-11-16T06:00:00.123+00:00' },
    { id: 'c2', name: 'Béta', score: 40, createdAt: '2026-11-17T06:00:00.456+00:00' },
  ]
  const welcome = buildSophieWelcome({ ...empty, newDiscoveries: discoveries }, { now, dismissed: none })
  assert.equal(welcome.suggestions[0]!.key, 'discoveries:2026-11-17T06:00:00')
  assert.equal(welcome.suggestions[0]!.label, 'Examiner les 2 découvertes de la semaine')
  assert.equal(welcome.suggestions[0]!.detail, 'La mieux notée : ACME (82/100)')
  const single = buildSophieWelcome({ ...empty, newDiscoveries: [discoveries[0]!] }, { now, dismissed: none })
  assert.equal(single.suggestions[0]!.href, '/companies/c1')
})

test('« Ignorer » écarte la suggestion, la suivante prend sa place ; 4 au plus', () => {
  const facts: SuggestionFacts = {
    ...empty,
    dueReminders: ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({
      id,
      title: id,
      dueAt: '2026-11-17T08:00:00Z',
      companyId: null,
      companyName: null,
    })),
  }
  assert.equal(buildSophieWelcome(facts, { now, dismissed: none }).suggestions.length, 4)
  const welcome = buildSophieWelcome(facts, { now, dismissed: new Set(['reminder:r1']) })
  assert.deepEqual(
    welcome.suggestions.map((suggestion) => suggestion.key),
    ['reminder:r2', 'reminder:r3', 'reminder:r4', 'reminder:r5']
  )
})
