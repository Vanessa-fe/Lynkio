import 'server-only'
import { after } from 'next/server'

const BREVO_API_URL = 'https://api.brevo.com/v3'

// Boîte de l'équipe, qui reçoit les alertes. L'expéditeur doit être vérifié dans Brevo
// (Expéditeurs, domaines et IP dédiées).
const TEAM_INBOX = 'contact@filonea.fr'

// Liste Brevo « Inscrits Filonea », pour les e-mails marketing (numéro visible dans Contacts > Listes)
const SIGNUP_LIST_ID = 3

/**
 * Appel à l'API de Brevo. Sans clé, rien n'est envoyé (renvoie false).
 * Une erreur de Brevo est notée dans les journaux sans bloquer la personne.
 */
async function brevoRequest(path: string, body: unknown): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return false

  const response = await fetch(`${BREVO_API_URL}${path}`, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    console.error(`Brevo error on ${path}:`, response.status, await response.text())
  }
  return response.ok
}

/**
 * Prévient l'équipe d'une nouvelle inscription, par e-mail (API transactionnelle de Brevo).
 * Envoyé après la réponse (after) : la personne qui s'inscrit n'attend pas l'envoi.
 */
export function notifySignup(signup: { email: string; confirmationRequired: boolean }) {
  after(() => sendSignupNotification(signup))
}

export async function sendSignupNotification(signup: { email: string; confirmationRequired: boolean }) {
  const date = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date())

  return brevoRequest('/smtp/email', {
    sender: { name: 'Filonea', email: process.env.BREVO_FROM_EMAIL || TEAM_INBOX },
    to: [{ email: TEAM_INBOX }],
    subject: `Nouvelle inscription sur Filonea : ${signup.email}`,
    textContent: [
      `${signup.email} vient de créer un compte sur Filonea (${date}).`,
      signup.confirmationRequired
        ? 'Son adresse n\'est pas encore confirmée : elle a reçu l\'e-mail de confirmation.'
        : 'Son compte est actif.',
    ].join('\n\n'),
  })
}

/**
 * Ajoute une personne inscrite à la liste Brevo des inscrits, une fois son adresse confirmée :
 * les adresses mal tapées ou fausses n'abîment pas la réputation des envois marketing.
 * Une personne déjà dans Brevo est mise à jour ; si elle s'était désinscrite, elle le reste.
 */
export function addToSignupList(email: string) {
  after(() => addContactToSignupList(email))
}

export async function addContactToSignupList(email: string) {
  if (!SIGNUP_LIST_ID) return false
  return brevoRequest('/contacts', { email, listIds: [SIGNUP_LIST_ID], updateEnabled: true })
}

/**
 * Retire une personne de Brevo (listes et historique) quand elle supprime son compte.
 * Une adresse inconnue de Brevo (404) n'est pas une erreur.
 */
export async function removeBrevoContact(email: string): Promise<boolean> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return false

  const response = await fetch(`${BREVO_API_URL}/contacts/${encodeURIComponent(email)}?identifierType=email_id`, {
    method: 'DELETE',
    headers: { 'api-key': apiKey, Accept: 'application/json' },
  })
  if (!response.ok && response.status !== 404) {
    console.error('Brevo error on contact removal:', response.status, await response.text())
  }
  return response.ok || response.status === 404
}
