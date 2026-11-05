import 'server-only'
import { after } from 'next/server'

// Boîte de l'équipe, qui reçoit les alertes. L'expéditeur doit être vérifié dans Brevo
// (Expéditeurs, domaines et IP dédiées).
const TEAM_INBOX = 'contact@filonea.fr'

/**
 * Prévient l'équipe d'une nouvelle inscription, par e-mail (API transactionnelle de Brevo).
 * Envoyé après la réponse (after) : la personne qui s'inscrit n'attend pas l'envoi.
 * Sans clé Brevo, rien n'est envoyé.
 */
export function notifySignup(signup: { email: string; confirmationRequired: boolean }) {
  after(() => sendSignupNotification(signup))
}

export async function sendSignupNotification(signup: { email: string; confirmationRequired: boolean }) {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return

  const date = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date())

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Filonea', email: process.env.BREVO_FROM_EMAIL || TEAM_INBOX },
      to: [{ email: TEAM_INBOX }],
      subject: `Nouvelle inscription sur Filonea : ${signup.email}`,
      textContent: [
        `${signup.email} vient de créer un compte sur Filonea (${date}).`,
        signup.confirmationRequired
          ? 'Son adresse n\'est pas encore confirmée : elle a reçu l\'e-mail de confirmation.'
          : 'Son compte est actif.',
      ].join('\n\n'),
    }),
  })

  if (!response.ok) {
    console.error('Signup notification error:', response.status, await response.text())
  }
}
