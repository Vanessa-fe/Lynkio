'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { logout } from '@/lib/actions/auth'
import { Logo } from '@/components/brand/logo'
import { navItems, isActivePath } from './nav-items'

export function Sidebar() {
  const pathname = usePathname()

  const handleLogout = async () => {
    await logout()
  }

  return (
    <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col md:p-3">
      <div className="flex min-h-0 flex-1 flex-col rounded-3xl border border-ink/[0.07] bg-white shadow-soft">
        <div className="flex h-16 items-center px-5">
          <Logo href="/dashboard" />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3" aria-label="Menu principal">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = isActivePath(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium',
                  isActive ? 'text-secondary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-xl bg-secondary"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <Icon
                  className={cn(
                    'relative h-5 w-5 transition-transform duration-300 group-hover:scale-110',
                    isActive && 'text-primary'
                  )}
                />
                <span className="relative">{item.label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-3">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Déconnexion
          </button>
        </div>
      </div>
    </aside>
  )
}
