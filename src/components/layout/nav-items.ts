import { Bell, Building2, Home, Radar, Settings, Users, type LucideIcon } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  /** Libellé court de la barre du bas, sur mobile */
  shortLabel: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Tableau de bord', shortLabel: 'Accueil', icon: Home },
  { href: '/prospection', label: 'Prospection', shortLabel: 'Sophie', icon: Radar },
  { href: '/companies', label: 'Entreprises', shortLabel: 'Sociétés', icon: Building2 },
  { href: '/people', label: 'Personnes', shortLabel: 'Contacts', icon: Users },
  { href: '/reminders', label: 'Relances', shortLabel: 'Relances', icon: Bell },
  { href: '/settings', label: 'Paramètres', shortLabel: 'Réglages', icon: Settings },
]

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}
