// Vérification de l'IA incluse dans Pro : mêmes quotas côté site et côté serveur, essai à moitié,
// mois compté à l'heure de Paris, messages clairs.
// Lancer : node --experimental-strip-types --test src/lib/__checks__/ai-quota.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as site from '../ai-quota.ts'
import { parisMonthStart as siteMonthStart } from '../billing.ts'
import * as server from '../../../supabase/functions/_shared/ai-quota.ts'

test('mêmes quotas et mêmes actions côté site et côté serveur', () => {
  assert.deepEqual(site.AI_QUOTAS, server.AI_QUOTAS)
  assert.deepEqual(site.AI_ACTIONS, server.AI_ACTIONS)
  assert.deepEqual(Object.keys(site.AI_QUOTA_LABELS).sort(), [...server.AI_ACTIONS].sort())
})

test('quotas décidés le 19/11/2026, et la moitié pendant l’essai', () => {
  assert.equal(server.aiQuota('draft', false), 300)
  assert.equal(server.aiQuota('chat', false), 300)
  assert.equal(server.aiQuota('deep_dive', false), 40)
  assert.equal(server.aiQuota('deep_dive', true), 20)
  assert.equal(site.aiQuota('assistant', true), 30)
})

test('le mois commence le 1er à minuit, heure de Paris', () => {
  // 1er décembre 2026 à 0 h 30 à Paris = 30 novembre 23 h 30 UTC : déjà décembre
  const now = new Date('2026-11-30T23:30:00Z')
  assert.equal(server.parisMonthStart(now).toISOString(), '2026-11-30T23:00:00.000Z')
  assert.equal(siteMonthStart(now).toISOString(), '2026-11-30T23:00:00.000Z')
  // En été (UTC+2)
  assert.equal(server.parisMonthStart(new Date('2026-07-15T10:00:00Z')).toISOString(), '2026-06-30T22:00:00.000Z')
})

test('le message de quota atteint dit quand le compteur repart', () => {
  assert.equal(server.nextResetLabel(new Date('2026-11-19T12:00:00Z')), '1er décembre')
  assert.equal(server.nextResetLabel(new Date('2026-12-20T12:00:00Z')), '1er janvier')
  const message = server.quotaReachedMessage('deep_dive', 40, new Date('2026-11-19T12:00:00Z'))
  assert.match(message, /vos 40 analyses « Approfondir » inclus ce mois-ci/)
  assert.match(message, /1er décembre/)
})
