// Libellés du journal d'accès et garde-fous des durées de conservation (npm run check)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_RETENTION,
  describeAccessLogEntry,
  isInactiveProspectMonths,
  isLinkedinPostsDays,
} from '../constants/data-retention.ts'

test('seules les durées autorisées par la base passent', () => {
  assert.equal(isInactiveProspectMonths(36), true)
  assert.equal(isInactiveProspectMonths(48), false)
  assert.equal(isLinkedinPostsDays(30), true)
  assert.equal(isLinkedinPostsDays(365), false)
})

test('par défaut : rien n’est effacé automatiquement, posts gardés 30 jours comme avant', () => {
  assert.equal(DEFAULT_RETENTION.auto_purge_enabled, false)
  assert.equal(DEFAULT_RETENTION.inactive_prospect_months, 36)
  assert.equal(DEFAULT_RETENTION.linkedin_posts_days, 30)
})

test('le journal se lit comme une phrase, au singulier comme au pluriel', () => {
  assert.equal(describeAccessLogEntry('export_companies', { companies: 1 }), 'Export de vos entreprises (1 entreprise)')
  assert.equal(describeAccessLogEntry('export_waalaxy', { contacts: 12 }), 'Export pour Waalaxy (12 contacts)')
  assert.equal(describeAccessLogEntry('api_key_saved', { provider: 'hunter' }), 'Clé Hunter enregistrée')
  assert.equal(
    describeAccessLogEntry('retention_purge', { trigger: 'schedule', companies: 3, contacts: 1 }),
    'Nettoyage automatique : 3 entreprises effacées, 1 contact'
  )
  assert.equal(
    describeAccessLogEntry('retention_changed', { auto_purge_enabled: true, inactive_prospect_months: 24 }),
    'Conservation : nettoyage activé, prospects sans suite gardés 2 ans'
  )
  assert.equal(describeAccessLogEntry('retention_changed', { auto_purge_enabled: false }), 'Conservation : nettoyage automatique désactivé')
})
