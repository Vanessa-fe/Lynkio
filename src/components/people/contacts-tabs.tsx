import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * Navigation secondaire de l'espace Contacts (lot 1.10) : les personnes et les listes, deux onglets
 * d'une même entrée du menu.
 */
export function ContactsTabs({ active }: { active: 'people' | 'lists' }) {
  const tabs = [
    { key: 'people', href: '/people', label: 'Personnes' },
    { key: 'lists', href: '/lists', label: 'Listes' },
  ] as const

  return (
    <nav aria-label="Contacts" className="inline-flex rounded-lg border bg-card p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active === tab.key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
