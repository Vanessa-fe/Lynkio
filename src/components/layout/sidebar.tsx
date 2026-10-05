'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Radar, Building2, Bell, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { logout } from '@/lib/actions/auth'
import { ThemeSelector } from '@/components/theme/theme-selector'

// Les modules contacts, rendez-vous, paiements et agences sortent du menu :
// Entreprises les remplace (refonte prospection, étape 3.2). Leurs pages restent
// accessibles jusqu'à la suppression de l'ancien modèle (étape 4).
const navItems = [
  {
    href: '/dashboard',
    label: 'Tableau de bord',
    icon: Home,
  },
  {
    href: '/prospection',
    label: 'Prospection',
    icon: Radar,
  },
  {
    href: '/companies',
    label: 'Entreprises',
    icon: Building2,
  },
  {
    href: '/reminders',
    label: 'Relances',
    icon: Bell,
  },
  {
    href: '/settings',
    label: 'Paramètres',
    icon: Settings,
  },
]

export function Sidebar() {
  const pathname = usePathname()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r bg-background">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 px-6 border-b">
          <h1 className="text-xl font-bold">Lynkio</h1>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="flex justify-center">
            <ThemeSelector />
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Déconnexion
          </Button>
        </div>
      </div>
    </aside>
  )
}
