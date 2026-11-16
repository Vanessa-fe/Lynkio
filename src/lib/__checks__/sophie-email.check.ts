// Vérification de l'e-mail des alertes de Sophie (objet, texte, HTML, sécurité des contenus).
// Lancer : node --experimental-strip-types --test src/lib/__checks__/sophie-email.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_ALERTS, renderAlertEmail, safeLink, splitTitle, type AlertRow } from '../../../supabase/functions/sophie-email/email.ts'

const signal = (title: string, extra: Partial<AlertRow> = {}): AlertRow => ({
  id: title,
  user_id: 'u',
  kind: 'signal',
  title,
  source: 'bodacc',
  source_url: 'https://www.bodacc.fr/annonce/123',
  event_at: '2026-11-12T00:00:00Z',
  period_start: null,
  period_end: null,
  counts: null,
  ...extra,
})

const digest: AlertRow = {
  id: 'd',
  user_id: 'u',
  kind: 'digest',
  title: 'Bilan',
  source: 'manual',
  source_url: null,
  event_at: null,
  // Semaine du lundi 0 h au lundi suivant 0 h, heure de Paris (comme en base)
  period_start: '2026-11-08T23:00:00Z',
  period_end: '2026-11-15T23:00:00Z',
  counts: { outgoing: 12, incoming: 1, meetings: 2, notes: 3 },
}

test('objet : signaux, bilan, ou les deux', () => {
  assert.equal(renderAlertEmail([signal('A')]).subject, 'Sophie : 1 nouveau signal')
  assert.equal(renderAlertEmail([signal('A'), signal('B')]).subject, 'Sophie : 2 nouveaux signaux')
  assert.equal(renderAlertEmail([digest]).subject, 'Votre bilan hebdomadaire de Sophie')
  assert.equal(renderAlertEmail([signal('A'), digest]).subject, 'Sophie : 1 nouveau signal et votre bilan de la semaine')
})

test('le HTML reprend la charte : logo, carte, bouton vers les alertes, désinscription', () => {
  const { html } = renderAlertEmail([signal('Pâtisserie Dupont · Création récente'), digest])
  assert.match(html, /background-color:#c9432f/)
  assert.match(html, />filonea</)
  assert.match(html, /href="https:\/\/filonea\.fr\/notifications"[^>]*>Tout voir dans Filonea/)
  assert.match(html, /Nouveaux signaux/)
  assert.match(html, /Votre bilan de la semaine/)
  assert.match(html, />12</)
  assert.match(html, /du 9 novembre au 15 novembre/)
  assert.match(html, /décochez la case/)
  assert.match(html, /pas un besoin confirmé/)
})

test('les textes venus de la base sont échappés, les liens dangereux supprimés', () => {
  const { html, text } = renderAlertEmail([
    signal('<script>alert(1)</script> & Cie', { source_url: 'javascript:alert(1)' }),
  ])
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; Cie/)
  assert.ok(!html.includes('javascript:'))
  assert.ok(!text.includes('javascript:'))
  assert.equal(safeLink('https://exemple.fr/a'), 'https://exemple.fr/a')
  assert.equal(safeLink('data:text/html,x'), null)
})

test(`au plus ${MAX_ALERTS} alertes détaillées, le reste résumé`, () => {
  const many = Array.from({ length: MAX_ALERTS + 4 }, (_, index) => signal(`Signal ${index}`))
  const { html, text } = renderAlertEmail(many)
  assert.match(html, /… et 4 autres alertes dans Filonea/)
  assert.match(text, /… et 4 autres alertes/)
  assert.ok(!html.includes(`Signal ${MAX_ALERTS + 1}<`))
})

test('titre « Signal · Entreprise » : l’entreprise d’abord', () => {
  assert.deepEqual(splitTitle('Entreprise créée récemment · MAISON GENIN'), { company: 'MAISON GENIN', signal: 'Entreprise créée récemment' })
  assert.deepEqual(splitTitle('Titre sans séparateur'), { company: 'Titre sans séparateur', signal: null })
  const { html } = renderAlertEmail([signal('Entreprise créée récemment · LA FOURMI')])
  assert.ok(html.indexOf('LA FOURMI') < html.indexOf('Entreprise créée récemment</div>'))
})

test('version texte lisible, avec la source et le lien', () => {
  const { text } = renderAlertEmail([signal('Nouvelle boutique')])
  assert.match(text, /Nouvelle boutique \(source : BODACC \(annonces légales\), événement du 12 novembre\) : https:\/\/www\.bodacc\.fr/)
  assert.match(text, /Tout voir dans Filonea : https:\/\/filonea\.fr\/notifications/)
})
