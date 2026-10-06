import { FadeIn } from '@/components/motion/reveal'
import { cn } from '@/lib/utils/cn'

/** Petit repère au-dessus d'un titre : « (02) — Fonctionnalités » */
export function SectionLabel({ index, label, className }: { index: string; label: string; className?: string }) {
  return (
    <FadeIn className={cn('flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]', className)}>
      <span className="size-1.5 rounded-full bg-current" />
      <span>
        ({index}) — {label}
      </span>
    </FadeIn>
  )
}
