'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import posthog from 'posthog-js'
import { Button, type ButtonProps } from '@/components/ui/button'
import { logout } from '@/lib/actions/auth'

/**
 * Déconnexion depuis une page sans menu (onboarding) : la session est fermée
 * côté serveur, qui renvoie ensuite vers la page de connexion
 */
export function LogoutButton({
  variant = 'ghost',
  size = 'sm',
  className,
  compact = false,
}: Pick<ButtonProps, 'variant' | 'size' | 'className'> & {
  /** Sur mobile, l'icône seule (le libellé reste lu par les lecteurs d'écran) */
  compact?: boolean
}) {
  const [isPending, setIsPending] = useState(false)

  const handleLogout = async () => {
    setIsPending(true)
    try {
      // La prochaine personne sur ce navigateur ne reprend pas l'identité PostHog du compte
      posthog.reset()
      await logout()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleLogout} disabled={isPending}>
      <LogOut className={compact ? 'h-4 w-4 sm:mr-2' : 'w-4 h-4 mr-2'} aria-hidden />
      <span className={compact ? 'max-sm:sr-only' : undefined}>{isPending ? 'Déconnexion...' : 'Se déconnecter'}</span>
    </Button>
  )
}
