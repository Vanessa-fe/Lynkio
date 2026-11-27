// Vérification de la colonne « Pays » de l'import et de l'identifiant officiel selon le pays :
// un fichier d'entreprises belges donne des fiches belges, avec leur numéro BCE, et un pays inconnu refuse la ligne.
// Lancer : node --experimental-strip-types --test src/lib/__checks__/countries.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  countryLabel,
  formatRegistrationId,
  normalizeRegistrationId,
  parseCountry,
  readCountryCell,
  registrationLabel,
  registrationUrl,
  usesSiren,
} from '../countries.ts'
import { toE164 } from '../phone.ts'

test('pays écrit en français, en anglais ou en code ISO', () => {
  for (const value of ['Belgique', 'belgique', 'BELGIQUE', 'Belgium', 'BE', 'be', ' Belgique ']) {
    assert.equal(parseCountry(value), 'BE', value)
  }
  assert.equal(parseCountry('Suisse'), 'CH')
  assert.equal(parseCountry('Switzerland'), 'CH')
  assert.equal(parseCountry('Luxembourg'), 'LU')
  assert.equal(parseCountry('Canada'), 'CA')
  assert.equal(parseCountry('France'), 'FR')
  assert.equal(parseCountry('Allemagne'), 'DE')
  assert.equal(parseCountry('Pays-Bas'), 'NL')
})

test('accents, apostrophes et noms courants', () => {
  assert.equal(parseCountry('États-Unis'), 'US')
  assert.equal(parseCountry('Etats Unis'), 'US')
  assert.equal(parseCountry('USA'), 'US')
  assert.equal(parseCountry('Royaume-Uni'), 'GB')
  assert.equal(parseCountry('UK'), 'GB')
  assert.equal(parseCountry("Côte d'Ivoire"), 'CI')
  assert.equal(parseCountry('Cote d’Ivoire'), 'CI')
  assert.equal(parseCountry('Maroc'), 'MA')
})

test('pays vide : France', () => {
  assert.equal(parseCountry(''), 'FR')
  assert.equal(parseCountry('   '), 'FR')
  assert.equal(parseCountry(undefined), 'FR')
  assert.deepEqual(readCountryCell(''), { value: 'FR' })
})

test('pays inconnu : la ligne est refusée avec un message qui cite la valeur', () => {
  assert.equal(parseCountry('Narnia'), null)
  assert.equal(parseCountry('XX'), null)
  assert.equal(parseCountry('Belgiqe'), null)
  const cell = readCountryCell(' Narnia ')
  assert.ok('error' in cell)
  assert.match(cell.error, /Pays non reconnu : « Narnia »/)
  assert.match(cell.error, /Belgique/)
})

test('SIREN en France : 9 chiffres, un SIRET donne son SIREN', () => {
  assert.deepEqual(normalizeRegistrationId('123 456 789', 'FR'), { value: '123456789' })
  assert.deepEqual(normalizeRegistrationId('12345678900012', 'FR'), { value: '123456789' })
  assert.deepEqual(normalizeRegistrationId('', 'FR'), { value: null })
  assert.deepEqual(normalizeRegistrationId(null, 'FR'), { value: null })
  assert.ok('error' in normalizeRegistrationId('12345678', 'FR'))
  // Un numéro BCE (10 chiffres) dans une ligne française reste refusé
  assert.ok('error' in normalizeRegistrationId('0123456749', 'FR'))
  // Outre-mer : même registre
  assert.deepEqual(normalizeRegistrationId('123456789', 'RE'), { value: '123456789' })
})

test('numéro BCE en Belgique : 10 chiffres, points, espaces et préfixe BE retirés', () => {
  // 0123456749 : 97 - (01234567 mod 97) = 49, la clé est bonne
  for (const value of ['0123456749', '0123.456.749', '0123 456 749', 'BE 0123.456.749', 'BE0123456749', 'be0123-456-749']) {
    assert.deepEqual(normalizeRegistrationId(value, 'BE'), { value: '0123456749' }, value)
  }
})

test('numéro BCE : le 0 retiré par Excel est rétabli, une faute de frappe est refusée', () => {
  assert.deepEqual(normalizeRegistrationId('123456749', 'BE'), { value: '0123456749' })
  // Mauvaise clé de contrôle, ou mauvais nombre de chiffres
  assert.ok('error' in normalizeRegistrationId('0123456789', 'BE'))
  assert.ok('error' in normalizeRegistrationId('012345674', 'BE'))
  assert.ok('error' in normalizeRegistrationId('01234567490', 'BE'))
  const error = normalizeRegistrationId('0123456789', 'BE')
  assert.ok('error' in error && /BCE/.test(error.error))
})

test('autres pays : identifiant gardé, sans ponctuation, en majuscules', () => {
  assert.deepEqual(normalizeRegistrationId('CHE-123.456.789', 'CH'), { value: 'CHE123456789' })
  assert.deepEqual(normalizeRegistrationId('che 123 456 789', 'CH'), { value: 'CHE123456789' })
  assert.deepEqual(normalizeRegistrationId(' - ', 'CH'), { value: null })
})

test('libellé, format et lien du registre selon le pays', () => {
  assert.equal(usesSiren('FR'), true)
  assert.equal(usesSiren(null), true)
  assert.equal(usesSiren('BE'), false)
  assert.equal(registrationLabel('FR'), 'SIREN')
  assert.equal(registrationLabel('BE'), 'N° d’entreprise (BCE)')
  assert.equal(formatRegistrationId('123456789', 'FR'), '123 456 789')
  assert.equal(formatRegistrationId('0123456749', 'BE'), '0123.456.749')
  assert.equal(formatRegistrationId('CHE123456789', 'CH'), 'CHE123456789')
  assert.equal(registrationUrl('123456789', 'FR'), 'https://annuaire-entreprises.data.gouv.fr/entreprise/123456789')
  assert.match(registrationUrl('0123456749', 'BE') ?? '', /^https:\/\/kbopub\.economie\.fgov\.be\/.*ondernemingsnummer=0123456749$/)
  assert.equal(registrationUrl('CHE123456789', 'CH'), null)
})

test('export : nom du pays en français, relu tel quel par l’import', () => {
  assert.equal(countryLabel('BE'), 'Belgique')
  assert.equal(countryLabel('FR'), 'France')
  assert.equal(countryLabel(null), 'France')
  for (const code of ['FR', 'BE', 'CH', 'LU', 'CA', 'DE', 'GB', 'US', 'CI']) {
    assert.equal(parseCountry(countryLabel(code)), code, code)
  }
})

test('ligne belge : le pays lu sert à lire le téléphone national', () => {
  const country = parseCountry('Belgique')
  assert.equal(toE164('0470 12 34 56', country), '+32470123456')
  assert.equal(toE164('069/88.84.70', country), '+3269888470')
})
