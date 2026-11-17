import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dashboardWelcome, type DashboardFacts } from '../dashboard-suggestions.ts'

const quiet: DashboardFacts = { overdueReminders: 0, todayReminders: 0, newDiscoveries: 0, unreadAlerts: 0, lastRunFailed: false }

test('rien à faire : pas de suggestion artificielle', () => {
  const welcome = dashboardWelcome(quiet)
  assert.equal(welcome.summary, 'Rien d’urgent aujourd’hui.')
  assert.deepEqual(welcome.suggestions, [])
})

test('découvertes et relances du jour : une phrase et une question', () => {
  const welcome = dashboardWelcome({ ...quiet, newDiscoveries: 12, todayReminders: 2 })
  assert.equal(
    welcome.summary,
    'Vous avez 12 nouvelles entreprises à examiner et 2 relances prévues aujourd’hui. Par quoi voulez-vous commencer ?'
  )
  assert.deepEqual(
    welcome.suggestions.map((suggestion) => suggestion.key),
    ['today', 'discoveries']
  )
})

test('les relances en retard passent en premier, et au plus trois suggestions', () => {
  const welcome = dashboardWelcome({
    overdueReminders: 1,
    todayReminders: 2,
    newDiscoveries: 1,
    unreadAlerts: 4,
    lastRunFailed: true,
  })
  assert.equal(welcome.summary, 'Vous avez 1 nouvelle entreprise à examiner et 3 relances à faire, dont 1 en retard. Par quoi voulez-vous commencer ?')
  assert.deepEqual(
    welcome.suggestions.map((suggestion) => suggestion.key),
    ['overdue', 'discoveries', 'run-failed']
  )
  assert.equal(welcome.suggestions[0]!.label, 'Traiter 1 relance en retard')
  assert.equal(welcome.suggestions[1]!.label, 'Examiner la nouvelle entreprise')
})

test('une seule chose : pas de question', () => {
  assert.equal(dashboardWelcome({ ...quiet, todayReminders: 1 }).summary, 'Vous avez 1 relance prévue aujourd’hui.')
})
