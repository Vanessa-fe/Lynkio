// Vérification : l'offre d'un abonnement est reconnue d'après la clé de son prix Stripe,
// y compris les anciens prix de lancement renommés « …_lancement ».
// Lancer : node --experimental-strip-types --test src/lib/__checks__/stripe-plan.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planFromLookupKey } from '../../../supabase/functions/_shared/stripe.ts'

test('clés habituelles', () => {
  assert.deepEqual(planFromLookupKey('essentiel_monthly'), { plan: 'essentiel', interval: 'month' })
  assert.deepEqual(planFromLookupKey('pro_yearly'), { plan: 'pro', interval: 'year' })
})

test('anciens prix de lancement : même offre, même période', () => {
  assert.deepEqual(planFromLookupKey('pro_monthly_lancement'), { plan: 'pro', interval: 'month' })
  assert.deepEqual(planFromLookupKey('essentiel_yearly_lancement'), { plan: 'essentiel', interval: 'year' })
})

test('clé inconnue ou absente', () => {
  assert.equal(planFromLookupKey('pro_weekly'), null)
  assert.equal(planFromLookupKey('pro_monthly_autre'), null)
  assert.equal(planFromLookupKey(null), null)
})
