import posthog from 'posthog-js'

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

if (token) {
  posthog.init(token, {
    // Passe par filonea.fr (réécriture /ingest de next.config.js) : moins souvent bloqué
    // par les bloqueurs de publicité
    api_host: '/ingest',
    ui_host: 'https://eu.posthog.com',
    defaults: '2026-08-30',
    // Bandeau cookies (components/analytics/cookie-banner.tsx) : tant que la personne n'a pas
    // accepté, ses visites sont comptées sans cookie (« cookieless » activé dans le projet PostHog)
    cookieless_mode: 'on_reject',
    opt_out_capturing_by_default: true,
    capture_exceptions: true,
  })
} else if (process.env.NODE_ENV === 'development') {
  throw new Error(
    'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured'
  )
}
