// Vérification de la lecture des plafonds LinkedIn (réponse de linkedin_send_caps, migration 00090)
// et des textes affichés. Le calcul lui-même est fait par la base.
// Lancer : node --experimental-strip-types --test src/lib/__checks__/linkedin-caps.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LINKEDIN_CAPS,
  linkedinCapsSummary,
  lowAcceptanceMessage,
  parseLinkedinCaps,
} from '../linkedin-caps.ts'

// Réponse réelle de la base : 100 invitations sur 7 jours, taux de 14 %, envoi automatique actif
const FULL_WEEK = {
  can_invite: false,
  can_message: true,
  ramp_up_until: null,
  week_frees_at: '2026-11-29T08:54:06.966129+00:00',
  low_acceptance: true,
  messages_today: 5,
  acceptance_rate: 14,
  invitations_week: 100,
  acceptance_judged: 50,
  invitations_today: 0,
  messages_today_cap: 20,
  daily_messages_limit: 20,
  invitations_week_cap: 100,
  invitations_today_cap: 7,
  invitations_held_until: null,
  daily_invitations_limit: 15,
}

test('réponse de la base lue telle quelle', () => {
  const caps = parseLinkedinCaps(FULL_WEEK)
  assert.equal(caps.invitationsWeek, 100)
  assert.equal(caps.invitationsTodayCap, 7)
  assert.equal(caps.acceptanceRate, 14)
  assert.equal(caps.lowAcceptance, true)
  assert.equal(caps.weekFreesAt, '2026-11-29T08:54:06.966129+00:00')
  assert.equal(caps.canInvite, false)
  assert.equal(caps.canMessage, true)
})

test('sans réponse (erreur de lecture) : plafonds par défaut', () => {
  assert.deepEqual(parseLinkedinCaps(null), DEFAULT_LINKEDIN_CAPS)
  assert.equal(DEFAULT_LINKEDIN_CAPS.invitationsTodayCap, 15)
  assert.equal(DEFAULT_LINKEDIN_CAPS.invitationsWeekCap, 100)
  assert.equal(DEFAULT_LINKEDIN_CAPS.messagesTodayCap, 20)
})

test('sans can_invite : déduit des compteurs (la limite de 100 sur 7 jours bloque même à 0 aujourd’hui)', () => {
  const { can_invite: _invite, can_message: _message, ...rest } = FULL_WEEK
  const caps = parseLinkedinCaps(rest)
  assert.equal(caps.canInvite, false)
  assert.equal(caps.canMessage, true)
})

test('les messages ne prennent pas la place des invitations', () => {
  const caps = parseLinkedinCaps({ ...FULL_WEEK, invitations_week: 10, messages_today: 20, can_invite: undefined, can_message: undefined })
  assert.equal(caps.canInvite, true)
  assert.equal(caps.canMessage, false)
})

test('résumé des compteurs, au format du brief', () => {
  const caps = parseLinkedinCaps({
    invitations_today: 9,
    invitations_today_cap: 15,
    invitations_week: 62,
    invitations_week_cap: 100,
    messages_today: 4,
    messages_today_cap: 20,
    acceptance_rate: 34,
  })
  assert.equal(
    linkedinCapsSummary(caps),
    'Invitations : 9/15 aujourd’hui · 62/100 cette semaine · Messages : 4/20 aujourd’hui · Taux d’acceptation : 34 %'
  )
  // Pas encore assez d'invitations pour un taux : il n'apparaît pas
  assert.ok(!linkedinCapsSummary({ ...caps, acceptanceRate: null }).includes('Taux'))
})

test('message du taux d’acceptation bas', () => {
  assert.ok(lowAcceptanceMessage(15).startsWith('Peu de vos invitations sont acceptées en ce moment (15 %).'))
})
