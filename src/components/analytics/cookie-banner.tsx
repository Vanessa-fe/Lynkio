'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import Link from 'next/link'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'

// Prévient PostHogIdentify qu'un choix vient d'être fait au bandeau
export const CONSENT_CHANGED_EVENT = 'filonea:consent-changed'
// Le bandeau s'ouvre ou se ferme (choix fait, ou lien « Cookies » du pied de page)
const BANNER_EVENT = 'filonea:cookie-banner'

// Rouvert depuis le pied de page pour changer d'avis
let reopened = false

function subscribe(onChange: () => void) {
  window.addEventListener(BANNER_EVENT, onChange)
  return () => window.removeEventListener(BANNER_EVENT, onChange)
}

function isBannerOpen() {
  // Sans clé de projet, PostHog n'est pas chargé : pas de bandeau
  if (!posthog.__loaded) return false
  return reopened || posthog.get_explicit_consent_status() === 'pending'
}

/**
 * Bandeau de consentement aux cookies de mesure d'audience (PostHog).
 * Accepter : suivi complet et enregistrement des sessions. Refuser, ou ne pas répondre :
 * visites comptées sans cookie. Le choix est retenu dans le navigateur par PostHog.
 */
export function CookieBanner() {
  const isOpen = useSyncExternalStore(subscribe, isBannerOpen, () => false)
  const bannerRef = useRef<HTMLDivElement>(null)

  // Hauteur du bandeau, pour que les boutons flottants (Sophie) se placent au-dessus au lieu d'être cachés
  useEffect(() => {
    const banner = bannerRef.current
    const root = document.documentElement
    if (!isOpen || !banner) return
    const observer = new ResizeObserver(() => root.style.setProperty('--cookie-banner-offset', `${banner.offsetHeight + 12}px`))
    observer.observe(banner)
    return () => {
      observer.disconnect()
      root.style.removeProperty('--cookie-banner-offset')
    }
  }, [isOpen])

  const choose = (accepted: boolean) => {
    if (accepted) posthog.opt_in_capturing()
    else posthog.opt_out_capturing()
    reopened = false
    window.dispatchEvent(new Event(BANNER_EVENT))
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT))
  }

  if (!isOpen) return null

  return (
    <div
      ref={bannerRef}
      role="region"
      aria-label="Cookies"
      // Mobile : au-dessus du menu du bas (et de la zone de saisie de Sophie), plus compact
      className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] rounded-2xl border border-ink/[0.07] bg-white p-3 text-sm text-ink shadow-soft sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm sm:p-4"
    >
      <p className="leading-relaxed text-ink/75">
        Filonea mesure son audience avec PostHog, hébergé en Europe
        <span className="max-sm:hidden">, pour comprendre comment le site est utilisé et l&apos;améliorer</span>.
        Rien n&apos;est revendu ni utilisé pour de la publicité. Vous acceptez les cookies de mesure ?{' '}
        <Link href="/confidentialite#cookies" className="font-medium text-ink underline underline-offset-2 hover:text-brand-700">
          En savoir plus
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => choose(false)}>
          Refuser
        </Button>
        <Button type="button" size="sm" className="flex-1" onClick={() => choose(true)}>
          Accepter
        </Button>
      </div>
    </div>
  )
}

/**
 * Lien « Cookies » du pied de page : rouvre le bandeau pour changer d'avis
 */
export function CookieSettingsButton({ className }: { className?: string }) {
  const reopen = () => {
    reopened = true
    window.dispatchEvent(new Event(BANNER_EVENT))
  }

  return (
    <button type="button" className={className} onClick={reopen}>
      Cookies
    </button>
  )
}
