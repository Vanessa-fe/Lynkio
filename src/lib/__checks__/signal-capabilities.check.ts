// Vérification du registre des capacités de détection (supabase/functions/_shared/signal-capabilities.ts).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/signal-capabilities.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import {
  SIGNAL_CAPABILITIES,
  SIGNAL_TYPE_AVAILABILITY,
  capabilityById,
  capabilityForSignal,
  signalCapabilityIds,
} from '../../../supabase/functions/_shared/signal-capabilities.ts'

test('identifiants uniques et stables (minuscules, chiffres, _)', () => {
  const ids = SIGNAL_CAPABILITIES.map((capability) => capability.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[a-z][a-z0-9_]{2,40}$/)
})

test('chaque signal disponible est créé par exactement une capacité', () => {
  for (const [signal, availability] of Object.entries(SIGNAL_TYPE_AVAILABILITY)) {
    const producers = SIGNAL_CAPABILITIES.filter((capability) => capability.signals.includes(signal))
    if (availability === 'available') assert.equal(producers.length, 1, `${signal} : une capacité attendue`)
    else assert.equal(producers.length, 0, `${signal} (${availability}) ne doit être créé par aucune capacité`)
  }
})

test('une capacité ne crée que des signaux connus et disponibles', () => {
  for (const capability of SIGNAL_CAPABILITIES) {
    for (const signal of capability.signals) {
      assert.equal(SIGNAL_TYPE_AVAILABILITY[signal], 'available', `${capability.id} crée ${signal}`)
    }
  }
})

test('seules les capacités « signal » créent des signaux ; la lecture du site n’en crée jamais', () => {
  for (const capability of SIGNAL_CAPABILITIES) {
    if (capability.purpose === 'signal') assert.ok(capability.signals.length > 0, capability.id)
    else assert.equal(capability.signals.length, 0, capability.id)
  }
  const context = capabilityById('site_context')
  assert.equal(context?.purpose, 'context')
  assert.equal(context?.signals.length, 0)
})

test('aucun appel IA pendant les recherches standards', () => {
  for (const capability of SIGNAL_CAPABILITIES.filter((c) => c.trigger === 'during_search')) {
    assert.equal(capability.cost.ai, 'none', `${capability.id} tourne à chaque recherche`)
  }
})

test('une analyse de site a un domaine ; les autres familles n’en ont pas', () => {
  for (const capability of SIGNAL_CAPABILITIES) {
    if (capability.family === 'site_analysis') assert.ok(capability.area, capability.id)
    else assert.equal(capability.area, undefined, capability.id)
  }
})

test('une recherche web garde les pages réellement consultées comme preuve', () => {
  for (const capability of SIGNAL_CAPABILITIES.filter((c) => c.cost.ai === 'web_search')) {
    assert.equal(capability.evidence, 'consulted_url', capability.id)
  }
})

test('une capacité sans signal dit combien de temps son observation reste valable', () => {
  for (const capability of SIGNAL_CAPABILITIES.filter((c) => c.signals.length === 0 && c.purpose !== 'sourcing')) {
    assert.ok((capability.validityDays ?? 0) > 0, capability.id)
  }
})

test('le code cité existe', () => {
  for (const capability of SIGNAL_CAPABILITIES) {
    for (const reference of capability.implementedIn) {
      const path = reference.split(' ')[0]!
      assert.ok(existsSync(path), `${capability.id} : ${path} introuvable`)
    }
  }
})

test('outils de lecture', () => {
  assert.equal(capabilityForSignal('recently_created')?.id, 'bodacc_creations')
  assert.equal(capabilityForSignal('funding_round'), undefined)
  assert.equal(capabilityForSignal('job_posting_dev'), undefined)
  assert.deepEqual(signalCapabilityIds().sort(), ['bodacc_creations', 'site_technical_protocol', 'site_technical_stack'])
})
