import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * Marque Filonea : un « F » dont la barre du haut se prolonge en un point qui émet,
 * le signal que Sophie repère.
 * `ping` anime le point (page d'accueil seulement).
 */
export function LogoMark({ className, ping = false }: { className?: string; ping?: boolean }) {
  return (
    <span className={cn('relative inline-flex size-8 shrink-0', className)}>
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand-600" />
        <path d="M11.5 23.5V8.5h4.5M11.5 15.5h3.5" fill="none" stroke="#fdfaf7" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22.3" cy="8.5" r="2.8" fill="#fbd3bf" />
      </svg>
      {ping && (
        <span
          aria-hidden
          className="absolute right-[19%] top-[17.5%] size-[19%] animate-ping rounded-full bg-peach/80 [animation-duration:2.4s]"
        />
      )}
    </span>
  )
}

export function Logo({
  href = '/',
  className,
  ping,
  onClick,
}: {
  href?: string
  className?: string
  ping?: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label="Filonea"
      className={cn('flex items-center gap-2.5 font-display text-xl font-bold tracking-[-0.04em]', className)}
    >
      <LogoMark ping={ping} />
      filonea
    </Link>
  )
}
