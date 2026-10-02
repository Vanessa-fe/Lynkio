// L'IA propose, le code vérifie : tout ce qui doit être exact (signature,
// signal cité) est fixé par le code, et ce qui peut poser problème à
// l'envoi est signalé à l'utilisatrice avant qu'elle copie le message.

import type { Channel, DraftFromAi, SignalForMessage } from './writer.ts'

const MAX_SUBJECT_LENGTH = 70
const MAX_EMAIL_WORDS = 180
const MAX_LINKEDIN_LENGTH = 700

export type CheckedDraft = {
  subject: string | null
  body: string
  angle: string
  signal: { id: string; label: string } | null
  warnings: string[]
}

function hostOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return null
  }
}

function urlsIn(text: string): string[] {
  return (text.match(/\b(?:https?:\/\/|www\.)[^\s)>\]»"]+/gi) ?? []).map((url) => url.replace(/[.,;:!?]+$/, ''))
}

/**
 * Vérifie le message proposé et y ajoute la signature
 */
export function checkDraft(
  draft: DraftFromAi,
  options: {
    channel: Channel
    signals: SignalForMessage[]
    // Adresses connues (site de l'entreprise, références) et textes fournis à l'IA :
    // seuls ces liens-là peuvent apparaître dans le message
    knownUrls: string[]
    knownTexts: (string | null)[]
    // Noms des clients confidentiels, qui ne doivent jamais apparaître
    confidentialClients: string[]
    signature: string | null
    lastOutgoingAt: string | null
  }
): CheckedDraft {
  const warnings: string[] = []
  const body = draft.body.replace(/\n{3,}/g, '\n\n').trim()
  const subject = options.channel === 'email' ? draft.subject.replace(/^objet\s*:\s*/i, '').trim() : null

  const text = [subject, body].filter(Boolean).join('\n')

  if (/\[[^\]\n]{1,40}\]|\{\{|\}\}|\bX{3,}\b/.test(text)) {
    warnings.push('Le message contient un champ à compléter (entre crochets) : remplacez-le avant l\'envoi.')
  }

  const knownHosts = new Set(
    [...options.knownUrls, ...options.knownTexts.flatMap((known) => (known ? urlsIn(known) : []))]
      .map(hostOf)
      .filter((host): host is string => host !== null)
  )
  for (const url of urlsIn(text)) {
    const host = hostOf(url)
    if (host && !knownHosts.has(host)) {
      warnings.push(`Lien à vérifier : ${url} (Sophie ne l'a pas reçu, elle a pu l'inventer).`)
    }
  }

  if (/\d[\d\s.,]*\s?(?:€|euros?\b|k€)|\bTJM\b|\btarifs?\b|\bprix\b/i.test(text)) {
    warnings.push('Le message parle de prix : mieux vaut en parler après un premier échange.')
  }

  for (const client of options.confidentialClients) {
    if (text.toLowerCase().includes(client.toLowerCase())) {
      warnings.push(`Le message cite ${client}, un client que vous avez marqué comme confidentiel.`)
    }
  }

  if (options.channel === 'email') {
    const words = body.split(/\s+/).filter(Boolean).length
    if (words > MAX_EMAIL_WORDS) warnings.push(`E-mail long (${words} mots) : un premier e-mail se lit mieux sous 150 mots.`)
    if (!subject) warnings.push('Objet manquant.')
    else if (subject.length > MAX_SUBJECT_LENGTH) warnings.push(`Objet long (${subject.length} caractères).`)
  } else if (body.length > MAX_LINKEDIN_LENGTH) {
    warnings.push(`Message long pour LinkedIn (${body.length} caractères) : visez moins de 600.`)
  }

  if (options.lastOutgoingAt) {
    warnings.push(
      `Vous avez déjà écrit à cette entreprise le ${new Date(options.lastOutgoingAt).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })} : ce message est rédigé comme un premier contact.`
    )
  }

  // L'IA cite un signal : il doit faire partie de ceux qu'elle a reçus
  const signal = options.signals.find((candidate) => candidate.id === draft.signal_id) ?? null

  return {
    subject,
    body: options.signature ? `${body}\n${options.signature}` : body,
    angle: draft.angle,
    signal: signal ? { id: signal.id, label: signal.label } : null,
    warnings,
  }
}
