import 'server-only'
import { after } from 'next/server'
import type { createClient } from '@/lib/supabase/server'

const BREVO_API_URL = 'https://api.brevo.com/v3'

// Boîte de l'équipe, qui reçoit les alertes. L'expéditeur doit être vérifié dans Brevo
// (Expéditeurs, domaines et IP dédiées).
const TEAM_INBOX = 'contact@filonea.fr'

// Boîte du formulaire d'aide (questions, problèmes, facturation)
const SUPPORT_INBOX = 'support@filonea.fr'

// Liste Brevo « Inscrits Filonea » : tous les comptes confirmés (e-mails de l'essai) ; les e-mails
// marketing ne vont qu'aux contacts OPT_IN = oui (numéro de liste visible dans Contacts > Listes)
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

type BrevoContact = { email: string; opt_in: boolean; attributes: Record<string, string | boolean | null> }

/**
 * Fiche Brevo du compte connecté (e-mails du cycle d'essai) : ajout à la liste des inscrits et mise à
 * jour des champs PRENOM, ENTREPRISE, METIER, DATE_INSCRIPTION, FIN_ESSAI, STATUT, OFFRE et
 * A_LANCE_RECHERCHE, calculés en base (fonction brevo_contact). Envoyé après la réponse, sans bloquer.
 *
 * withOptIn : seulement à la confirmation de l'adresse, pour noter la case « conseils et nouveautés » de
 * l'inscription (OPT_IN). Ensuite on ne l'envoie plus : un désabonnement fait dans Brevo reste respecté.
 * Une adresse non confirmée n'est jamais ajoutée : les adresses fausses n'abîment pas la réputation des envois.
 */
export function syncBrevoContact(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  options: { withOptIn?: boolean } = {}
) {
  after(async () => {
    const { data, error } = await supabase.rpc('brevo_contact', { p_user_id: userId })
    if (error || !data) {
      if (error) console.error('Brevo contact:', error)
      return
    }
    await sendBrevoContact(data as BrevoContact, options)
  })
}

export async function sendBrevoContact(contact: BrevoContact, options: { withOptIn?: boolean } = {}) {
  return brevoRequest('/contacts', {
    email: contact.email,
    attributes: options.withOptIn ? { ...contact.attributes, OPT_IN: contact.opt_in } : contact.attributes,
    listIds: [SIGNUP_LIST_ID],
    updateEnabled: true,
  })
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

const FEEDBACK_KIND_LABELS: Record<string, string> = {
  idea: 'Idée de fonction',
  improvement: 'Point à améliorer',
  problem: 'Problème',
  other: 'Autre',
}

/**
 * Prévient l'équipe d'un message de la boîte à idées (envoyé après la réponse, sans faire attendre)
 */
export function notifyFeedback(feedback: { email: string | null; kind: string; message: string; page: string | null }) {
  after(() =>
    brevoRequest('/smtp/email', {
      sender: { name: 'Filonea', email: process.env.BREVO_FROM_EMAIL || TEAM_INBOX },
      to: [{ email: TEAM_INBOX }],
      ...(feedback.email ? { replyTo: { email: feedback.email } } : {}),
      subject: `Boîte à idées : ${FEEDBACK_KIND_LABELS[feedback.kind] ?? feedback.kind}${feedback.email ? ` de ${feedback.email}` : ''}`,
      textContent: [
        feedback.message,
        '—',
        `Type : ${FEEDBACK_KIND_LABELS[feedback.kind] ?? feedback.kind}`,
        feedback.page ? `Envoyé depuis : ${feedback.page}` : null,
        feedback.email ? `Répondre à : ${feedback.email}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  )
}

/**
 * Transmet un message du formulaire d'aide à support@filonea.fr ; « Répondre » écrit à la personne.
 * Attendu (pas after) : si l'envoi échoue, la personne le sait et peut écrire directement.
 */
export async function sendSupportRequest(request: {
  name: string
  email: string
  topicLabel: string
  message: string
  userId: string | null
  accountEmail: string | null
}) {
  return brevoRequest('/smtp/email', {
    sender: { name: 'Filonea', email: process.env.BREVO_FROM_EMAIL || TEAM_INBOX },
    to: [{ email: SUPPORT_INBOX }],
    replyTo: { email: request.email, name: request.name },
    subject: `Aide : ${request.topicLabel} (${request.name})`,
    textContent: [
      request.message,
      '—',
      `De : ${request.name} <${request.email}>`,
      `Sujet : ${request.topicLabel}`,
      request.userId
        ? `Compte connecté : ${request.accountEmail ?? 'adresse inconnue'} (${request.userId})`
        : 'Envoyé sans être connecté',
    ].join('\n'),
  })
}
