'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Building2, Bell, Settings } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { ThemeSelector } from '@/components/theme/theme-selector'

const navItems = [
  {
    href: '/dashboard',
    label: 'Accueil',
    icon: Home,
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
    label: 'Réglages',
    icon: Settings,
  },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
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
