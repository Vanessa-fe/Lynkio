'use client'

import { createClient } from '@/lib/supabase/client'

/**
 * Envoie un message à Sophie (fonction sophie-chat) et lit sa réponse au fil de l'eau.
 * Appel direct depuis le navigateur avec le jeton de l'utilisateur : une action serveur serait coupée
 * par Netlify au bout d'une dizaine de secondes.
 */

export type SophiePageContext = { page: string; entityType: 'company' | null; entityId: string | null }

export type SophieEvent =
  | { type: 'meta'; conversationId: string; title: string; provider: string }
  | { type: 'delta'; text: string }
  | { type: 'status'; text: string }
  | { type: 'card'; card: unknown }
  | { type: 'done'; messageId: string | null }
  | { type: 'error'; message: string; code?: string }

const CONNECTION_ERROR = 'Connexion impossible avec Sophie : vérifiez votre connexion Internet, puis réessayez.'

export async function askSophie(options: {
  conversationId: string | null
  message: string
  context: SophiePageContext
  onEvent: (event: SophieEvent) => void
  signal?: AbortSignal
}): Promise<void> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) {
    options.onEvent({ type: 'error', message: 'Votre session a expiré : rechargez la page pour vous reconnecter.', code: 'auth' })
    return
  }

  let response: Response
  try {
    response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/sophie-chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversationId: options.conversationId, message: options.message, context: options.context }),
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    options.onEvent({ type: 'error', message: CONNECTION_ERROR })
    return
  }

  // Refus avant la réponse (plafond, clé manquante, offre…) : message clair renvoyé en JSON
  if (!response.ok || !response.body || !response.headers.get('Content-Type')?.includes('text/event-stream')) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null
    options.onEvent({ type: 'error', message: body?.error ?? CONNECTION_ERROR, code: body?.code })
    return
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  let finished = false
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      let separator: number
      while ((separator = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)
        const line = chunk.split('\n').find((candidate) => candidate.startsWith('data:'))
        if (!line) continue
        try {
          const event = JSON.parse(line.slice(5).trim()) as SophieEvent
          if (event.type === 'done' || event.type === 'error') finished = true
          options.onEvent(event)
        } catch {
          // morceau illisible : ignoré
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
  }
  // Flux coupé avant la fin : on le dit, au lieu de laisser croire à une réponse complète
  if (!finished) options.onEvent({ type: 'error', message: 'La réponse de Sophie a été interrompue : réessayez.' })
}
