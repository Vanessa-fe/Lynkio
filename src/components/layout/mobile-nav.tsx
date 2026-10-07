'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils/cn'
import { navItems, isActivePath } from './nav-items'

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Menu principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-ink/[0.07] bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-6">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = isActivePath(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex min-w-0 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium leading-tight',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="mobile-nav-active"
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-primary"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <Icon className="h-5 w-5" />
              <span className="max-w-full truncate px-0.5">{item.shortLabel}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
