// Vérification des numéros de téléphone : tout numéro enregistré est au format E.164, lu selon le pays
// de l'entreprise, et le lien WhatsApp garde le message intact.
// Lancer : node --experimental-strip-types --test src/lib/__checks__/phone.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { E164_PATTERN, toE164, toWhatsAppLink } from '../phone.ts'

test('numéro français national', () => {
  assert.equal(toE164('06 12 34 56 78', 'FR'), '+33612345678')
  assert.equal(toE164('0612345678', 'FR'), '+33612345678')
})

test('numéro belge national, sur une entreprise belge', () => {
  assert.equal(toE164('0470 12 34 56', 'BE'), '+32470123456')
})

test('le même numéro national est lu selon le pays de l’entreprise', () => {
  // 04 70 12 34 56 existe aussi en France (fixe du sud-est) : sans le pays, on se tromperait
  assert.equal(toE164('0470 12 34 56', 'FR'), '+33470123456')
  assert.equal(toE164('0470 12 34 56', 'BE'), '+32470123456')
})

test('numéro déjà international : son propre pays l’emporte', () => {
  assert.equal(toE164('+32 470 12 34 56', 'FR'), '+32470123456')
  assert.equal(toE164('+33 6 12 34 56 78', 'BE'), '+33612345678')
  assert.equal(toE164('0032 470 12 34 56', 'FR'), '+32470123456')
})

test('espaces, points, tirets et parenthèses', () => {
  assert.equal(toE164('06.12.34.56.78', 'FR'), '+33612345678')
  assert.equal(toE164(' 06-12-34-56-78 ', 'FR'), '+33612345678')
  assert.equal(toE164('+33 (0)6 12 34 56 78', 'FR'), '+33612345678')
})

test('pays absent ou en minuscules : France par défaut', () => {
  assert.equal(toE164('06 12 34 56 78', null), '+33612345678')
  assert.equal(toE164('0470 12 34 56', 'be'), '+32470123456')
})

test('numéro invalide ou vide : null', () => {
  assert.equal(toE164('12', 'FR'), null)
  assert.equal(toE164('06 12 34', 'FR'), null)
  assert.equal(toE164('pas un numéro', 'FR'), null)
  assert.equal(toE164('', 'FR'), null)
  assert.equal(toE164('   ', 'FR'), null)
  assert.equal(toE164(null, 'FR'), null)
  assert.equal(toE164('06 12 34 56 78', 'XX'), null)
})

test('tout numéro accepté respecte la contrainte de la base', () => {
  for (const [raw, country] of [['06 12 34 56 78', 'FR'], ['0470 12 34 56', 'BE'], ['+41 79 123 45 67', 'FR']] as const) {
    const e164 = toE164(raw, country)
    assert.ok(e164 && E164_PATTERN.test(e164), `${raw} → ${e164}`)
  }
})

test('lien WhatsApp : numéro sans « + », message complet encodé', () => {
  const message = 'Bonjour Élise,\nje suis Camille, développeuse web à Lille.\nUn échange de 15 minutes ?'
  const link = toWhatsAppLink('+32470123456', message)
  assert.ok(link.startsWith('https://wa.me/32470123456?text='))
  assert.equal(new URL(link).searchParams.get('text'), message)
  assert.ok(!link.includes(' ') && !link.includes('\n'))
})
