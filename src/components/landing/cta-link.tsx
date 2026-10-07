import Link from 'next/link'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'dark' | 'light' | 'outline' | 'outline-light'

const styles: Record<Variant, { base: string; fill: string; hoverText: string }> = {
  primary: { base: 'bg-brand-600 text-cream shadow-lift', fill: 'bg-ink', hoverText: 'group-hover:text-cream' },
  dark: { base: 'bg-ink text-cream', fill: 'bg-brand-600', hoverText: 'group-hover:text-cream' },
  light: { base: 'bg-cream text-ink', fill: 'bg-ink', hoverText: 'group-hover:text-cream' },
  outline: { base: 'border border-ink/20 bg-white/40 text-ink backdrop-blur', fill: 'bg-ink', hoverText: 'group-hover:text-cream' },
  'outline-light': { base: 'border border-cream/40 text-cream', fill: 'bg-cream', hoverText: 'group-hover:text-ink' },
}

/** Texte qui « roule » vers le haut au survol du parent `.group`. */
export function RollText({ children }: { children: string }) {
  return (
    <span className="relative inline-flex overflow-hidden">
      <span className="transition-transform duration-500 ease-out-expo group-hover:-translate-y-full">{children}</span>
      <span
        aria-hidden
        className="absolute inset-0 translate-y-full transition-transform duration-500 ease-out-expo group-hover:translate-y-0"
      >
        {children}
      </span>
    </span>
  )
}

function Arrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn('size-3.5', className)} aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Bouton-lien de la page d'accueil : remplissage qui monte et texte qui roule au survol. */
export function CtaLink({
  children,
  variant = 'primary',
  arrow,
  size = 'md',
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, 'children'> & {
  children: string
  variant?: Variant
  arrow?: boolean
  size?: 'sm' | 'md'
}) {
  const s = styles[variant]
  return (
    <Link
      className={cn(
        'group relative inline-flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full font-medium tracking-tight',
        size === 'md' ? 'px-6 py-3.5 text-sm md:text-[15px]' : 'px-4 py-2.5 text-sm',
        s.base,
        className
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 origin-bottom scale-y-0 rounded-[inherit] transition-transform duration-500 ease-out-expo group-hover:scale-y-100',
          s.fill
        )}
      />
      <span className={cn('relative flex items-center gap-2 transition-colors duration-300', s.hoverText)}>
        <RollText>{children}</RollText>
        {arrow ? <Arrow className="transition-transform duration-500 ease-out-expo group-hover:translate-x-1" /> : null}
      </span>
    </Link>
  )
}
