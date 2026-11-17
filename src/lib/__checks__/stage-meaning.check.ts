import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeStage, prospectingStage, roleFitsKind, stageWithRole, type MeaningStage } from '../stage-meaning.ts'

// Pipeline personnalisé : noms changés, « Relancé » retirée, une étape ajoutée sans rôle
const stages: MeaningStage[] = [
  { id: 'a', name: 'Pistes', kind: 'open', role: null, order: 0, is_default: true },
  { id: 'b', name: 'Premier message', kind: 'open', role: 'contacted', order: 1, is_default: false },
  { id: 'c', name: 'Échanges', kind: 'open', role: 'in_discussion', order: 2, is_default: false },
  { id: 'd', name: 'Devis envoyé', kind: 'open', role: 'proposal', order: 3, is_default: false },
  { id: 'e', name: 'Atelier découverte', kind: 'open', role: null, order: 4, is_default: false },
  { id: 'f', name: 'Client', kind: 'won', role: null, order: 5, is_default: false },
  { id: 'g', name: 'Refus', kind: 'lost', role: 'not_concluded', order: 6, is_default: false },
  { id: 'h', name: 'Silence radio', kind: 'lost', role: null, order: 7, is_default: false },
]

test('une étape renommée est comprise par son rôle, pas par son nom', () => {
  const meaning = describeStage(stages[3]!, stages)
  assert.equal(meaning.role, 'proposal')
  assert.equal(meaning.meaning, 'proposition envoyée')
  assert.equal(meaning.position, 4)
  assert.equal(meaning.openCount, 5)
  assert.equal(meaning.summary, 'Devis envoyé : proposition envoyée (étape en cours 4 sur 5)')
})

test('une étape sans rôle est comprise par sa nature et sa position, sans deviner', () => {
  const meaning = describeStage(stages[4]!, stages)
  assert.equal(meaning.role, null)
  assert.equal(meaning.meaning, 'démarche en cours')
  assert.equal(meaning.summary, 'Atelier découverte : démarche en cours (étape en cours 5 sur 5)')
})

test('étapes closes et étape d’arrivée', () => {
  assert.equal(describeStage(stages[5]!, stages).summary, 'Client : signée (étape close, signée)')
  assert.equal(describeStage(stages[7]!, stages).meaning, 'non concrétisée')
  assert.equal(describeStage(stages[6]!, stages).meaning, 'non concrétisé')
  assert.equal(describeStage(stages[0]!, stages).isArrival, true)
  assert.ok(describeStage(stages[0]!, stages).summary.includes('arrivée des nouvelles entreprises'))
})

test('pas de répétition quand le nom dit déjà la même chose', () => {
  const meeting: MeaningStage = { id: 'm', name: 'Rendez-vous', kind: 'open', role: 'meeting', order: 1, is_default: false }
  assert.equal(describeStage(meeting, [meeting]).summary, 'Rendez-vous (étape en cours 1 sur 1)')
})

test('un rôle incohérent avec la nature est ignoré', () => {
  const odd: MeaningStage = { id: 'x', name: 'Bizarre', kind: 'won', role: 'proposal', order: 9, is_default: false }
  assert.equal(describeStage(odd, [odd]).role, null)
  assert.equal(roleFitsKind('lost', 'no_follow_up'), true)
  assert.equal(roleFitsKind('open', 'no_follow_up'), false)
  assert.equal(roleFitsKind('excluded', null), true)
})

test('retrouver l’étape qui porte un rôle, quel que soit son nom', () => {
  assert.equal(stageWithRole(stages, 'proposal')?.name, 'Devis envoyé')
  assert.equal(stageWithRole(stages, 'followed_up'), null)
})

test('commencer à prospecter : de l’arrivée vers « À contacter », sinon l’étape suivante', () => {
  const withRole: MeaningStage[] = [
    { id: 'arr', name: 'À qualifier', kind: 'open', role: null, order: 0, is_default: true },
    { id: 'tc', name: 'Premiers pas', kind: 'open', role: 'to_contact', order: 1, is_default: false },
    { id: 'ct', name: 'Contacté', kind: 'open', role: 'contacted', order: 2, is_default: false },
  ]
  assert.equal(prospectingStage(withRole, 'arr')?.id, 'tc')
  assert.equal(prospectingStage(withRole, null)?.id, 'tc')
  // Déjà ailleurs : on ne touche pas à l'étape
  assert.equal(prospectingStage(withRole, 'ct'), null)
  // Pipeline sans rôle « À contacter » : première étape en cours après l'arrivée
  assert.equal(prospectingStage(stages, 'a')?.id, 'b')
  // Nouveau compte : l'arrivée EST « À contacter » : rien à changer
  const arrivalIsToContact: MeaningStage[] = [
    { id: 'x', name: 'À contacter', kind: 'open', role: 'to_contact', order: 0, is_default: true },
    { id: 'y', name: 'Contacté', kind: 'open', role: 'contacted', order: 1, is_default: false },
  ]
  assert.equal(prospectingStage(arrivalIsToContact, 'x'), null)
})
