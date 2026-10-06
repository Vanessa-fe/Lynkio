import { FadeIn } from '@/components/motion/reveal'
import { cn } from '@/lib/utils/cn'

/** Pastille au-dessus d'un titre de section. */
export function SectionLabel({ label, tone = 'light', className }: { label: string; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <FadeIn className={className}>
      <span
        className={cn(
          'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold',
          tone === 'light' ? 'border-brand-200 bg-white/70 text-brand-700' : 'border-cream/15 bg-cream/5 text-brand-300'
        )}
      >
        <span className="size-1.5 rounded-full bg-current" />
        {label}
      </span>
    </FadeIn>
  )
}
