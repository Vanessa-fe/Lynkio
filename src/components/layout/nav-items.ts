import { Bell, Building2, Home, Radar, Settings, Users, type LucideIcon } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  /** Libellé court de la barre du bas, sur mobile */
  shortLabel: string
  icon: LucideIcon
  /** Autres pages de cette entrée (Contacts : l'onglet Listes) */
  also?: string[]
}

// Six entrées (lot 1.10) : Pipeline commercial est dans Entreprises (vue Kanban), Listes est un onglet
// de Contacts, Relances s'appelle Suivi
export const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', shortLabel: 'Accueil', icon: Home },
  { href: '/prospection', label: 'Prospection', shortLabel: 'Sophie', icon: Radar },
  { href: '/companies', label: 'Entreprises', shortLabel: 'Sociétés', icon: Building2 },
  { href: '/people', label: 'Contacts', shortLabel: 'Contacts', icon: Users, also: ['/lists'] },
  { href: '/reminders', label: 'Suivi', shortLabel: 'Suivi', icon: Bell },
  { href: '/settings', label: 'Paramètres', shortLabel: 'Réglages', icon: Settings },
]

export function isActivePath(pathname: string, href: string) {
  const matches = (path: string) => pathname === path || pathname.startsWith(path + '/')
  return matches(href) || (navItems.find((item) => item.href === href)?.also ?? []).some(matches)
}
