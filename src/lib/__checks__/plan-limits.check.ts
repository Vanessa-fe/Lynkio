// Vérification des limites des offres (décision du 15/11/2026 : Essentiel 9 €, Pro 20 €).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/plan-limits.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { COUNTED_RUNS_FILTER, PLAN_LIMITS, runCountsTowardLimits, weeklyRunAvailableAt } from '../billing.ts'

// Heures de Paris en novembre (UTC+1)
const paris = (iso: string) => new Date(`${iso}+01:00`)

test('Essentiel : 2 recherches, 20 entreprises, 6 mots-clés, 2 jours ; Pro : 7 jours, 50 entreprises, 10 mots-clés', () => {
  assert.deepEqual(
    { ...PLAN_LIMITS.essentiel },
    { searchKeywords: 6, companiesPerRun: 20, daysPerWeek: 2, runsPerWeek: 2, strategies: 5, manualRunsPerDay: 5 }
  )
  assert.deepEqual(
    { ...PLAN_LIMITS.pro },
    { searchKeywords: 10, companiesPerRun: 50, daysPerWeek: 7, runsPerWeek: null, strategies: 20, manualRunsPerDay: 5 }
  )
})

test('les limites de Sophie (fonctions Supabase) sont les mêmes que celles du site', () => {
  const shared = readFileSync(new URL('../../../supabase/functions/_shared/plan.ts', import.meta.url), 'utf8')
  for (const plan of ['essentiel', 'pro'] as const) {
    const { searchKeywords, companiesPerRun, runsPerWeek } = PLAN_LIMITS[plan]
    assert.match(shared, new RegExp(`${plan}: \\{ searchKeywords: ${searchKeywords}, companiesPerRun: ${companiesPerRun}, runsPerWeek: ${runsPerWeek} \\}`))
  }
})

test('Pro : aucune limite par semaine', () => {
  assert.equal(weeklyRunAvailableAt([paris('2026-11-16T09:00:00'), paris('2026-11-15T09:00:00')], null), null)
})

test('Essentiel : la deuxième recherche de la semaine reste possible', () => {
  assert.equal(weeklyRunAvailableAt([], 2), null)
  assert.equal(weeklyRunAvailableAt([paris('2026-11-16T09:00:00')], 2), null)
})

test('Essentiel : après lundi et jeudi, la suivante est possible le lundi suivant à minuit', () => {
  const next = weeklyRunAvailableAt([paris('2026-11-19T09:00:00'), paris('2026-11-16T09:00:03')], 2)
  assert.equal(next?.toISOString(), paris('2026-11-23T00:00:00').toISOString())
})

test('Essentiel : un lundi planifié qui démarre quelques secondes plus tôt passe quand même', () => {
  const next = weeklyRunAvailableAt([paris('2026-11-19T09:00:00'), paris('2026-11-16T09:00:59')], 2)
  assert.ok(next && next <= paris('2026-11-23T09:00:00'))
})

test('Essentiel : changement d’heure (fin mars) compté au jour près, heure de Paris', () => {
  const next = weeklyRunAvailableAt([new Date('2027-03-26T08:00:00Z'), new Date('2027-03-24T08:00:00Z')], 2)
  // Minuit le mercredi 31 mars 2027 à Paris (heure d'été, UTC+2)
  assert.equal(next?.toISOString(), '2027-03-30T22:00:00.000Z')
})

test('prix affichés : Essentiel 9 € / 90 €, Pro 20 € / 200 €, dans les textes et les conditions', () => {
  const content = readFileSync(new URL('../../components/landing/content.ts', import.meta.url), 'utf8')
  assert.match(content, /key: 'essentiel'[\s\S]*?monthly: 9,\s*yearly: 90,/)
  assert.match(content, /key: 'pro'[\s\S]*?monthly: 20,\s*yearly: 200,/)
  assert.match(content, /Pro à 20 € par mois \(200 € par an\)/)
  const terms = readFileSync(new URL('../../app/conditions/page.tsx', import.meta.url), 'utf8')
  assert.match(terms, /9 € par mois ou 90 € par an\. <strong>Pro<\/strong> : 20 € par mois ou 200 € par/)
})

test('une recherche sans résultat ou échouée ne compte pas ; celle en cours compte toujours', () => {
  assert.equal(runCountsTowardLimits({ status: 'running', companies_created: 0 }), true)
  assert.equal(runCountsTowardLimits({ status: 'succeeded', companies_created: 3 }), true)
  assert.equal(runCountsTowardLimits({ status: 'succeeded', companies_created: 0 }), false)
  assert.equal(runCountsTowardLimits({ status: 'failed', companies_created: 0 }), false)
})

test('même règle de décompte dans le site, dans Sophie (fonctions Supabase) et en base', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
  const shared = read('../../../supabase/functions/_shared/plan.ts')
  assert.ok(shared.includes(`export const COUNTED_RUNS_FILTER = '${COUNTED_RUNS_FILTER}'`))
  assert.ok(shared.includes(`return run.status === 'running' || (run.status === 'succeeded' && run.companies_created > 0)`))
  // Les trois requêtes de décompte utilisent le filtre (plus de simple « non échouée »)
  for (const path of ['../queries/prospection.ts', '../actions/prospection.ts', '../../../supabase/functions/prospection-run/index.ts']) {
    const source = read(path)
    assert.ok(source.includes('.or(COUNTED_RUNS_FILTER)'), path)
    assert.ok(!source.includes(".neq('status', 'failed')"), path)
  }
  const migration = read('../../../supabase/migrations/00064_empty_runs_not_counted.sql')
  assert.ok(migration.includes(`AND (status = 'running' OR (status = 'succeeded' AND companies_created > 0))`))
})
