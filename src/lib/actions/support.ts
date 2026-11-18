'use server'

import { headers } from 'next/headers'
import { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { sendSupportRequest } from '@/lib/brevo'
import { LEGAL } from '@/lib/constants/legal'
import { SUPPORT_TOPICS, supportSchema, type SupportInput } from '@/lib/validations/support'
import { captureServerError, captureServerEvent } from '@/lib/posthog-server'

type ActionResult = { success: boolean; error?: string }

const SEND_FAILED = `Envoi impossible pour le moment : réessayez, ou écrivez directement à ${LEGAL.supportEmail}.`

/** Adresse IP de la personne, donnée par Netlify (sinon le premier relais), pour limiter les robots */
async function clientIp(): Promise<string | null> {
  const requestHeaders = await headers()
  const ip =
    requestHeaders.get('x-nf-client-connection-ip') ?? requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim()
  return ip || null
}

/**
 * Formulaire d'aide, ouvert à tous : enregistré en base (limites contre les robots) puis envoyé à
 * support@filonea.fr, avec la personne en adresse de réponse.
 */
export async function sendSupportMessage(input: SupportInput): Promise<ActionResult> {
  try {
    const { name, email, topic, message, website, startedAt } = supportSchema.parse(input)

    // Robot : on répond comme si tout allait bien, sans rien envoyer
    if (website || (startedAt && Date.now() - startedAt < 3000)) {
      captureServerEvent('support-bot', 'support_bot_blocked')
      return { success: true }
    }

    const user = await getAuthUser()
    const supabase = await createClient()
    const { data: accepted, error } = await supabase.rpc('submit_support_request', {
      p_name: name,
      p_email: email,
      p_topic: topic,
      p_message: message,
      p_ip: (await clientIp()) ?? undefined,
    })
    if (error) throw error
    if (!accepted) {
      return {
        success: false,
        error: `Plusieurs messages en peu de temps : réessayez dans une heure, ou écrivez à ${LEGAL.supportEmail}.`,
      }
    }

    const sent = await sendSupportRequest({
      name,
      email,
      topicLabel: SUPPORT_TOPICS.find((option) => option.value === topic)?.label ?? topic,
      message,
      userId: user?.id ?? null,
      accountEmail: user?.email ?? null,
    })
    if (!sent) {
      captureServerError(new Error('support e-mail not sent'), user?.id, { action: 'sendSupportMessage' })
      return { success: false, error: SEND_FAILED }
    }

    captureServerEvent(user?.id ?? 'support-visitor', 'support_message_sent', { topic, signed_in: !!user })
    return { success: true }
  } catch (error) {
    if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? 'Message invalide' }
    captureServerError(error, undefined, { action: 'sendSupportMessage' })
    return { success: false, error: SEND_FAILED }
  }
}
