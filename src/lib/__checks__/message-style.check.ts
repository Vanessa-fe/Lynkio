// Vérification de la règle qui reconnaît un message écrit ou réécrit par la freelance
// (src/lib/message-style.ts) : seul un texte vraiment à elle devient un exemple de son style.
// Lancer : node --experimental-strip-types --test src/lib/__checks__/message-style.check.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanExample, isSameText, isWrittenByHer, textSimilarity } from '../message-style.ts'

const SOPHIE =
  'Bonjour Élise, je suis Vanessa, développeuse web freelance. J’ai vu que TRIBEKAI recrute un développeur front pour sa nouvelle plateforme : c’est souvent le moment où un renfort ponctuel aide à tenir les délais. Seriez-vous d’accord pour un échange de 15 minutes cette semaine ?'
const HERS = 'Bonjour Élise, Vanessa ici, dev freelance. Vu votre annonce front chez TRIBEKAI : besoin d’un coup de main ? On en parle 10 min ?'

test('mêmes mots : ressemblance 1 ; rien en commun : 0', () => {
  assert.equal(textSimilarity(SOPHIE, SOPHIE), 1)
  assert.equal(textSimilarity('alpha beta gamma', 'delta epsilon'), 0)
})

test('quelques mots changés : même texte (brouillon de Sophie accepté)', () => {
  const touched = SOPHIE.replace('cette semaine', 'la semaine prochaine').replace('Bonjour', 'Bonjour à vous')
  assert.ok(isSameText(SOPHIE, touched))
  assert.equal(isWrittenByHer(touched, { sophieDrafts: [SOPHIE], examples: [] }), false)
})

test('message réécrit plus court, dans son style : retenu', () => {
  assert.ok(!isSameText(SOPHIE, HERS))
  assert.equal(isWrittenByHer(HERS, { sophieDrafts: [SOPHIE], examples: [] }), true)
})

test('message écrit sans brouillon de Sophie : retenu', () => {
  assert.equal(isWrittenByHer(HERS, { sophieDrafts: [], examples: [] }), true)
})

test('pas retenu deux fois, ni s’il n’a pas changé depuis la version enregistrée', () => {
  assert.equal(isWrittenByHer(HERS, { sophieDrafts: [], examples: [HERS] }), false)
  assert.equal(isWrittenByHer(HERS, { previous: HERS, sophieDrafts: [], examples: [] }), false)
})

test('trop court pour dire quelque chose d’un style', () => {
  assert.equal(isWrittenByHer('Bonjour, on en parle ?', { sophieDrafts: [], examples: [] }), false)
})

test('les mentions ajoutées par Filonea au premier e-mail ne font pas partie du style', () => {
  const email = `${HERS}\n\nVanessa\n\nJ'ai trouvé votre adresse sur le site de TRIBEKAI. Pour ne plus recevoir de message de ma part : https://filonea.fr/stop/abc123`
  assert.equal(cleanExample(email), `${HERS}\n\nVanessa`)
})
