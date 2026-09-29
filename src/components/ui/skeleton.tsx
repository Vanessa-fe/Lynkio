import { cn } from '@/lib/utils'

/**
 * Bloc gris animé qui tient la place d'un contenu en cours de chargement
 * (animation .skeleton de globals.css)
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('skeleton rounded-md', className)} />
}

/**
 * Zone de chargement annoncée aux lecteurs d'écran
 */
export function LoadingRegion({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">Chargement…</span>
      {children}
    </div>
  )
}
