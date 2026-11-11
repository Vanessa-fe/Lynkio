'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, useState } from 'react'

// Au-delà, la barre se termine d'elle-même (lien vers un fichier, navigation annulée…)
const SAFETY_TIMEOUT_MS = 15_000

/**
 * Fine barre en haut de l'écran pendant chaque changement de page : le serveur met parfois une seconde
 * à répondre, et sans signe visible on croit que le clic n'a pas marché.
 * Elle démarre au clic sur un lien interne et s'arrête quand la nouvelle adresse est affichée.
 */
function Progress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // Nouvelle adresse affichée : la barre se remplit puis disparaît
  useEffect(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    const finish = setTimeout(() => setState((current) => (current === 'loading' ? 'done' : current)), 0)
    const hide = setTimeout(() => setState('idle'), 400)
    timers.current.push(finish, hide)
  }, [pathname, searchParams])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = (event.target as Element | null)?.closest?.('a')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const href = link.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      const url = new URL(href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return

      timers.current.forEach(clearTimeout)
      timers.current = [setTimeout(() => setState('idle'), SAFETY_TIMEOUT_MS)]
      setState('loading')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  if (state === 'idle') return null
  return (
    <div
      role="progressbar"
      aria-label="Chargement de la page"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5"
    >
      <div
        className={
          state === 'loading'
            ? 'h-full w-[85%] origin-left animate-[navigation-progress_8s_cubic-bezier(0.1,0.7,0.2,1)_forwards] bg-primary shadow-[0_0_8px_hsl(var(--primary))]'
            : 'h-full w-full bg-primary opacity-0 transition-opacity duration-300'
        }
      />
    </div>
  )
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <Progress />
    </Suspense>
  )
}
