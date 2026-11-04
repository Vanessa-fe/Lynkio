import 'server-only'
import { after } from 'next/server'
import { PostHog } from 'posthog-node'

let client: PostHog | null = null

/**
 * Client PostHog côté serveur, ou null sans clé de projet (l'app fonctionne sans PostHog).
 * En développement, l'absence de clé est signalée : sinon les événements manquent sans bruit.
 */
export function getPostHogServer(): PostHog | null {
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
  if (!token) {
    if (process.env.NODE_ENV === 'development') {
      throw new Error(
        'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured'
      )
    }
    return null
  }

  // Envoi immédiat : une action serveur s'arrête dès sa réponse rendue
  client ??= new PostHog(token, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
    flushAt: 1,
    flushInterval: 0,
  })
  return client
}

/**
 * Événement produit, rattaché au compte (identifiant Supabase, comme posthog.identify côté
 * navigateur). Envoyé après la réponse (after) : l'utilisateur n'attend pas PostHog.
 * Aucun cookie : compté même quand la personne refuse le bandeau.
 */
export function captureServerEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  after(async () => {
    await getPostHogServer()?.captureImmediate({ distinctId, event, properties })
  })
}

/**
 * Erreur rattrapée par une action serveur : remontée dans le suivi d'erreurs de PostHog
 */
export function captureServerError(error: unknown, distinctId?: string, properties?: Record<string, unknown>) {
  after(async () => {
    await getPostHogServer()?.captureExceptionImmediate(error, distinctId, properties)
  })
}
