'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { logout } from '@/lib/actions/auth'

/**
 * Déconnexion depuis une page sans menu (onboarding) : la session est fermée
 * côté serveur, qui renvoie ensuite vers la page de connexion
 */
export function LogoutButton({ variant = 'ghost', size = 'sm', className }: Pick<ButtonProps, 'variant' | 'size' | 'className'>) {
  const [isPending, setIsPending] = useState(false)

  const handleLogout = async () => {
    setIsPending(true)
    try {
      await logout()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button type="button" variant={variant} size={size} className={className} onClick={handleLogout} disabled={isPending}>
      <LogOut className="w-4 h-4 mr-2" />
      {isPending ? 'Déconnexion...' : 'Se déconnecter'}
    </Button>
  )
}
