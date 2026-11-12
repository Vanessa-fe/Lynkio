import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findNotices, filterError, noticeDetails, searchUrl } from '../boamp.ts'

const filters = { service: '', buyer: '', cpv: '', department: '', zone: 'publication', days: '' }
const future = '2099-10-12T10:30:00+00:00'
const source = (id: string) => 'https://www.boamp.fr/pages/avis/?q=idweb:' + id
const cpv = { 'cbc:ItemClassificationCode': { '@listName': 'cpv', '#text': '80580000' } }

test('filtres bornés, zone choisie et échéance de réponse indépendante de la fin de diffusion', () => {
  const url = searchUrl({ ...filters, zone: 'prestation', department: '03', days: '7', buyer: "Côte d'Or" }, 2, new Date('2026-11-12T14:00:00Z'))
  const where = url.searchParams.get('where')!
  assert.match(where, /code_departement_prestation in \("3","03"\)/)
  assert.match(where, /datelimitereponse <= date'2026-11-19T14:00:00.000Z'/)
  assert.equal(url.searchParams.get('offset'), '10')
  assert.ok(filterError({ ...filters, cpv: '8058' }))
  assert.ok(filterError({ ...filters, buyer: 'a" or true' }))
})

test('CPV structurés FNS et eForms, et preuves explicites de participation', () => {
  const solo = 'Les opérateurs économiques peuvent se présenter seuls ou en groupement'
  const data = JSON.stringify([cpv, { classPrincipale: '79410000', phone: '12345678', text: solo + '.' },
    { '@listName': 'reserved-procurement', '#text': 'res-ws' }])
  assert.deepEqual(noticeDetails(data), { codes: ['80580000', '79410000'], solo, reservedLot: true })
  assert.equal(noticeDetails(JSON.stringify({ text: 'Formulaire DC2 du candidat individuel.' })).solo, undefined)
  assert.deepEqual(noticeDetails(null).codes, [])
})

test('ne conserve que les avis distincts, encore valables, concordant avec le CPV et la source', async t => {
  const row = (id: string) => ({ idweb: id, etat: 'INITIAL', url_avis: source(id), datelimitereponse: future, donnees: JSON.stringify(cpv) })
  const rows = [row('26-1'), row('26-1'), row('26-2'), { ...row('26-3'), etat: 'ANNULE' },
    { ...row('26-4'), donnees: '{"ref":"80580000"}' }, { ...row('26-5'), url_avis: source('26-1') },
    { ...row('26-6'), datelimitereponse: '2000-01-01T12:00:00Z' }, { ...row('26-7'), etat: 'RECTIFICATIF' }]
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    const results = url.searchParams.get('select')?.includes('donnees') ? rows : [{ annonce_lie: ['26-2'] }]
    return Response.json({ total_count: results.length, results })
  })
  const { notices } = await findNotices({ ...filters, cpv: '80580000' }, 1)
  assert.deepEqual(notices.map(n => [n.idweb, n.datelimitereponse, n.url_avis]), [
    ['26-1', future, source('26-1')], ['26-7', future, source('26-7')],
  ])
})

test('une indisponibilité BOAMP ne devient pas une recherche vide', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 429 }))
  await assert.rejects(findNotices(filters, 1), /indisponible/)
})
