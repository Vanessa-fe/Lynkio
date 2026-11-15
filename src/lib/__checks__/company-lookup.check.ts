import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blockedReason,
  classifyLookupQuery,
  headcountLabel,
  broaderQuery,
  rankCandidates,
  siteNameFromHtml,
  toRegistryRecord,
  type ApiCompany,
} from '../registry-parse.ts'

const base: ApiCompany = {
  siren: '552100554',
  nom_complet: 'ATELIER DUPONT',
  date_creation: '2015-03-01',
  activite_principale: '62.01Z',
  section_activite_principale: 'J',
  tranche_effectif_salarie: '12',
  etat_administratif: 'A',
  statut_diffusion: 'O',
  opposition_diffusion_commerciale: false,
  finances: { '2022': { ca: 800000, resultat_net: 50000 }, '2023': { ca: 950000.4, resultat_net: null }, '2024': { ca: 0 } },
  dirigeants: [
    { nom: 'MARTIN', prenoms: 'JEAN-PIERRE PAUL', qualite: 'Gérant', type_dirigeant: 'personne physique' },
    { nom: 'HOLDING X', type_dirigeant: 'personne morale' },
  ],
  siege: { adresse: '12 RUE DE LA PAIX 69002 LYON', code_postal: '69002', libelle_commune: 'LYON' },
}

test('la saisie est reconnue comme SIREN, SIRET, site ou nom', () => {
  assert.deepEqual(classifyLookupQuery('  '), { kind: 'empty' })
  assert.deepEqual(classifyLookupQuery('552 100 554'), { kind: 'siren', siren: '552100554' })
  assert.deepEqual(classifyLookupQuery('552 100 554 00012'), { kind: 'siren', siren: '552100554' })
  assert.deepEqual(classifyLookupQuery('atelier-dupont.fr'), { kind: 'website', url: 'https://atelier-dupont.fr' })
  assert.deepEqual(classifyLookupQuery('www.dupont.com/contact'), { kind: 'website', url: 'https://www.dupont.com/contact' })
  assert.deepEqual(classifyLookupQuery('http://dupont.fr'), { kind: 'website', url: 'http://dupont.fr' })
  assert.deepEqual(classifyLookupQuery('Atelier Dupont'), { kind: 'name', name: 'Atelier Dupont' })
  // Un nom avec un point mais des espaces reste un nom
  assert.deepEqual(classifyLookupQuery('Dupont & Fils S.A.'), { kind: 'name', name: 'Dupont & Fils S.A.' })
})

test('la fiche officielle est lue : taille, secteur, adresse, dernier CA publié, dirigeants', () => {
  const record = toRegistryRecord(base)
  assert.equal(record.sizeCategory, 'pme')
  assert.equal(record.sector, 'Information et communication')
  assert.equal(record.address, '12 Rue De La Paix 69002 Lyon')
  assert.equal(record.city, 'Lyon')
  assert.deepEqual(record.finances, { revenue: 950000, netIncome: null, year: 2023 })
  assert.deepEqual(record.directors, [{ firstName: 'Jean-Pierre', lastName: 'Martin', role: 'Gérant' }])
  assert.equal(record.refusesProspecting, false)
  assert.equal(blockedReason(record), null)
  assert.equal(headcountLabel(record.headcountCode), '20 à 49 salariés')
  assert.equal(headcountLabel('NN'), null)
})

test('opposition à la prospection et données masquées bloquent le pré-remplissage', () => {
  assert.match(blockedReason(toRegistryRecord({ ...base, opposition_diffusion_commerciale: true })) ?? '', /prospection/)
  assert.match(blockedReason(toRegistryRecord({ ...base, statut_diffusion: 'P' })) ?? '', /masquées/)
  assert.match(blockedReason(toRegistryRecord({ ...base, nom_complet: '[NON-DIFFUSIBLE]' })) ?? '', /masquées/)
})

test('les homonymes utilisables passent avant les cessées puis les refus', () => {
  const ranked = rankCandidates([{
    query: 'Atelier Dupont',
    records: [
      toRegistryRecord({ ...base, siren: '1', opposition_diffusion_commerciale: true }),
      toRegistryRecord({ ...base, siren: '2', etat_administratif: 'C' }),
      toRegistryRecord({ ...base, siren: '3' }),
      toRegistryRecord({ ...base, siren: '4' }),
    ],
  }])
  assert.deepEqual(ranked.map((record) => record.siren), ['3', '4', '2', '1'])
})

test('« GFT » : le nom qui commence par la saisie et l\'employeur passent devant les SCI homonymes', () => {
  const company = (siren: string, nom_complet: string, tranche_effectif_salarie = 'NN') =>
    toRegistryRecord({ ...base, siren, nom_complet, tranche_effectif_salarie })
  const ranked = rankCandidates([{
    query: 'GFT',
    records: [
      company('1', 'GFT'),
      company('2', 'GOLDEN FOOD TRADING (GFT)', '01'),
      company('3', 'GFT FRANCE SAS', '21'),
      company('4', 'GFT 34', '11'),
      company('5', 'GFTX'),
    ],
  }])
  assert.deepEqual(ranked.map((record) => record.siren), ['3', '4', '1', '2', '5'])
})

test('une saisie de plusieurs mots est élargie à son premier mot, sans doublons', () => {
  assert.equal(broaderQuery('GFT technologies'), 'GFT')
  assert.equal(broaderQuery('GFT'), null)
  assert.equal(broaderQuery('A b'), null)
  const ranked = rankCandidates([
    { query: 'GFT technologies', records: [toRegistryRecord({ ...base, siren: '1', nom_complet: 'GFT TECHNOLOGIES SE' })] },
    {
      query: 'GFT',
      records: [
        toRegistryRecord({ ...base, siren: '1', nom_complet: 'GFT TECHNOLOGIES SE' }),
        toRegistryRecord({ ...base, siren: '2', nom_complet: 'GFT FRANCE SAS', tranche_effectif_salarie: '21' }),
      ],
    },
  ])
  assert.deepEqual(ranked.map((record) => record.siren), ['1', '2'])
})

test('le nom du site est lu dans og:site_name, sinon dans le titre sans slogan', () => {
  assert.equal(siteNameFromHtml('<meta property="og:site_name" content="Atelier Dupont &amp; Fils">'), 'Atelier Dupont & Fils')
  assert.equal(siteNameFromHtml('<title>Atelier Dupont | Menuiserie à Lyon</title>'), 'Atelier Dupont')
  assert.equal(siteNameFromHtml('<title>Dupont – Accueil</title>'), 'Dupont')
  assert.equal(siteNameFromHtml('<p>sans titre</p>'), null)
})
