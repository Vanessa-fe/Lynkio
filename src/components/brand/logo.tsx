import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * Marque Lynkio : un « L » et un point qui émet, le signal que Sophie repère.
 * `ping` anime le point (page d'accueil seulement).
 */
export function LogoMark({ className, ping = false }: { className?: string; ping?: boolean }) {
  return (
    <span className={cn('relative inline-flex size-8 shrink-0', className)}>
      <svg viewBox="0 0 32 32" className="size-full" aria-hidden>
        <rect width="32" height="32" rx="9" className="fill-brand-600" />
        <path d="M11 8.5v15h10" fill="none" stroke="#fdfaf7" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="22" cy="10.5" r="3.2" fill="#fbd3bf" />
      </svg>
      {ping && (
        <span
          aria-hidden
          className="absolute right-[18%] top-[22%] size-[20%] animate-ping rounded-full bg-peach/80 [animation-duration:2.4s]"
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
    <Link href={href} onClick={onClick} className={cn('flex items-center gap-2.5 font-display text-xl font-bold tracking-[-0.04em]', className)}>
      <LogoMark ping={ping} />
      lynkio
    </Link>
  )
}
