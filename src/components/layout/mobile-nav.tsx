'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Radar, Building2, Users, Bell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ThemeSelector } from '@/components/theme/theme-selector'

const navItems = [
  {
    href: '/dashboard',
    label: 'Accueil',
    icon: Home,
  },
  {
    href: '/prospection',
    label: 'Sophie',
    icon: Radar,
  },
  {
    href: '/companies',
    label: 'Sociétés',
    icon: Building2,
  },
  {
    href: '/people',
    label: 'Contacts',
    icon: Users,
  },
  {
    href: '/reminders',
    label: 'Relances',
    icon: Bell,
  },
  {
    href: '/settings',
    label: 'Réglages',
    icon: Settings,
  },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="grid grid-cols-7 gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-w-0 flex-col items-center justify-center gap-1 py-2 text-[10px] leading-tight transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-0.5">{item.label}</span>
            </Link>
          )
        })}
        <div className="flex flex-col items-center justify-center py-2">
          <ThemeSelector />
        </div>
      </div>
    </nav>
  )
}
