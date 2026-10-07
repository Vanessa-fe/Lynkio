'use client'

import { ReactLenis } from 'lenis/react'
import { useReducedMotion } from 'motion/react'

/**
 * Scroll fluide pour la page d'accueil seulement : dans l'application, il gênerait
 * les tableaux, les listes déroulantes et les fenêtres.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  if (reduce) return <>{children}</>

  return (
    <ReactLenis root options={{ lerp: 0.1, anchors: { offset: -80 } }}>
      {children}
    </ReactLenis>
  )
}
