import 'server-only'
import { after } from 'next/server'

// Expéditeur des e-mails de connexion (domaine solynk.fr vérifié dans Resend) et boîte de l'équipe
const FROM = 'Filonea <lynkio@solynk.fr>'
const TEAM_INBOX = 'contact@filonea.fr'

/**
 * Prévient l'équipe d'une nouvelle inscription, par e-mail (Resend). Envoyé après la réponse
 * (after) : la personne qui s'inscrit n'attend pas l'envoi. Sans clé Resend, rien n'est envoyé.
 */
export function notifySignup(signup: { email: string; confirmationRequired: boolean }) {
  after(() => sendSignupNotification(signup))
}

export async function sendSignupNotification(signup: { email: string; confirmationRequired: boolean }) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  const date = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date())

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: TEAM_INBOX,
      subject: `Nouvelle inscription sur Filonea : ${signup.email}`,
      text: [
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
