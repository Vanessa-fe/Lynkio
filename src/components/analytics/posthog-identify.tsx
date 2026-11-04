'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { CONSENT_CHANGED_EVENT } from './cookie-banner'

/**
 * Rattache les visites au compte connecté, avec le même identifiant que les événements
 * envoyés par le serveur (identifiant Supabase). Seulement après accord au bandeau cookies :
 * sans accord, les visites restent anonymes.
 */
export function PostHogIdentify({
  userId,
  email,
  professionKey,
}: {
  userId: string
  email: string | null
  professionKey: string | null
}) {
  useEffect(() => {
    const identify = () => {
      if (!posthog.__loaded || posthog.get_explicit_consent_status() !== 'granted') return
      posthog.identify(userId, { email, profession_key: professionKey })
    }

    identify()
    window.addEventListener(CONSENT_CHANGED_EVENT, identify)
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, identify)
  }, [userId, email, professionKey])

  return null
}
