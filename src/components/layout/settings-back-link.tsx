'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Pages ouvertes depuis Paramètres, hors du dossier /settings
const FROM_SETTINGS = ['/notifications', '/help', '/ideas']

/**
 * Retour « Paramètres » en haut de chaque page ouverte depuis Paramètres, ajouté automatiquement
 * (une nouvelle page sous /settings l'a sans rien faire)
 */
export function SettingsBackLink() {
  const pathname = usePathname()
  const fromSettings = pathname.startsWith('/settings/') || FROM_SETTINGS.includes(pathname)
  if (!fromSettings) return null
  return (
    <Button variant="ghost" size="sm" className="mb-4" asChild>
      <Link href="/settings">
        <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
        Paramètres
      </Link>
    </Button>
  )
}
