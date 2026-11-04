import type { Instrumentation } from 'next'

/**
 * Erreurs non rattrapées côté serveur (pages, actions, routes) : envoyées au suivi
 * d'erreurs de PostHog, rattachées au visiteur quand son cookie PostHog est présent
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { getPostHogServer } = await import('@/lib/posthog-server')
  const posthog = getPostHogServer()
  if (!posthog) return

  let distinctId: string | undefined
  const cookie = request.headers.cookie
  const posthogCookie = (Array.isArray(cookie) ? cookie.join('; ') : cookie)?.match(/ph_phc_.*?_posthog=([^;]+)/)
  if (posthogCookie?.[1]) {
    try {
      distinctId = JSON.parse(decodeURIComponent(posthogCookie[1])).distinct_id
    } catch {
      // Cookie illisible : l'erreur est envoyée sans visiteur
    }
  }

  await posthog.captureExceptionImmediate(error, distinctId, { path: request.path })
}
