import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planPipelineSimplification, type SimplifyStage } from '../pipeline-simplify.ts'

// Pipeline d'origine des premiers comptes
const legacy: SimplifyStage[] = [
  ['À qualifier', 'open', null, true],
  ['À contacter', 'open', 'to_contact', false],
  ['Contacté', 'open', 'contacted', false],
  ['Relancé', 'open', 'followed_up', false],
  ['En discussion', 'open', 'in_discussion', false],
  ['Rendez-vous', 'open', 'meeting', false],
  ['Proposition envoyée', 'open', 'proposal', false],
  ['Gagné', 'won', null, false],
  ['Perdu', 'lost', 'not_concluded', false],
  ['Sans suite', 'lost', 'no_follow_up', false],
  ['Hors cible', 'excluded', null, false],
].map(([name, kind, role, isDefault], order) => ({
  id: `s${order}`,
  name: name as string,
  kind: kind as string,
  role: role as string | null,
  is_default: isDefault as boolean,
  order,
}))

test('ancien pipeline : 4 propositions et un « après » identique aux nouveaux comptes', () => {
  const plan = planPipelineSimplification(legacy, { s0: 129, s3: 2 })
  assert.deepEqual(plan.steps.map((step) => step.id), ['arrival', 'followed_up', 'negotiation', 'rename'])
  assert.match(plan.steps[0]!.detail, /129 entreprises/)
  assert.match(plan.steps[1]!.detail, /2 entreprises de cette étape passent dans « Contacté »/)
  assert.deepEqual(
    plan.after.map((stage) => `${stage.name}${stage.isDefault ? '*' : ''}`),
    ['À contacter*', 'Contacté', 'En discussion', 'Rendez-vous', 'Proposition envoyée', 'Négociation', 'Signé', 'Non concrétisé', 'Sans suite', 'Hors cible']
  )
})

test('pipeline déjà à jour : rien à proposer', () => {
  const current = planPipelineSimplification(legacy, {}).after.map((stage, order) => ({
    id: `n${order}`,
    name: stage.name,
    kind: stage.kind,
    role: legacy.find((item) => item.name === stage.name)?.role ?? (stage.name === 'Négociation' ? 'negotiation' : null),
    is_default: stage.isDefault,
    order,
  }))
  assert.deepEqual(planPipelineSimplification(current, {}).steps, [])
})

test('noms personnalisés : jamais renommés', () => {
  const custom = legacy.map((stage) => (stage.name === 'Gagné' ? { ...stage, name: 'Mission signée' } : stage))
  const plan = planPipelineSimplification(custom, {})
  const rename = plan.steps.find((step) => step.id === 'rename')!
  assert.doesNotMatch(rename.detail, /Mission signée/)
  assert.match(rename.detail, /« Perdu » devient « Non concrétisé »/)
})

test('proposition décochée : l’aperçu la garde telle quelle', () => {
  const plan = planPipelineSimplification(legacy, {}, new Set(['negotiation']))
  assert.equal(plan.steps.length, 4)
  assert.deepEqual(plan.after.slice(0, 2).map((stage) => stage.name), ['À qualifier', 'À contacter'])
  assert.equal(plan.after.find((stage) => stage.isDefault)?.name, 'À qualifier')
  assert.ok(plan.after.some((stage) => stage.name === 'Relancé'))
  assert.ok(plan.after.some((stage) => stage.name === 'Gagné'))
})

test('étape d’arrivée avec un rôle : on n’y touche pas', () => {
  const arrivalWithRole = legacy
    .filter((stage) => stage.name !== 'À qualifier')
    .map((stage) => (stage.role === 'to_contact' ? { ...stage, is_default: true } : stage))
  const plan = planPipelineSimplification(arrivalWithRole, {})
  assert.ok(!plan.steps.some((step) => step.id === 'arrival'))
})
