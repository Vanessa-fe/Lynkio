// Vérification du plafond WhatsApp : le compteur du jour part de minuit, heure de Paris
// (whatsappDayStart dans src/lib/whatsapp.ts appelle parisMidnight), en hiver comme en été.
// Lancer : node --experimental-strip-types --test src/lib/__checks__/whatsapp.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parisMidnight } from '../billing.ts'

test('hiver : à 23 h 30 à Paris, le jour compté est encore celui qui se termine', () => {
  // 27/11/2026 22:30 UTC = 23:30 à Paris (UTC+1) → la journée a commencé le 27 à minuit, soit le 26 à 23:00 UTC
  assert.equal(parisMidnight(new Date('2026-11-27T22:30:00Z')).toISOString(), '2026-11-26T23:00:00.000Z')
})

test('hiver : passé minuit à Paris, le compteur repart à zéro', () => {
  // 27/11/2026 23:30 UTC = 28/11 00:30 à Paris → nouvelle journée depuis 23:00 UTC
  assert.equal(parisMidnight(new Date('2026-11-27T23:30:00Z')).toISOString(), '2026-11-27T23:00:00.000Z')
})

test('été : minuit à Paris tombe à 22:00 UTC', () => {
  // 01/07/2026 22:30 UTC = 02/07 00:30 à Paris (UTC+2)
  assert.equal(parisMidnight(new Date('2026-07-01T22:30:00Z')).toISOString(), '2026-07-01T22:00:00.000Z')
  assert.equal(parisMidnight(new Date('2026-07-01T21:30:00Z')).toISOString(), '2026-06-30T22:00:00.000Z')
})

test('jour du changement d’heure (29/03/2026) : la journée commence bien à minuit, heure d’hiver', () => {
  assert.equal(parisMidnight(new Date('2026-03-29T12:00:00Z')).toISOString(), '2026-03-28T23:00:00.000Z')
})
