import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/** Encadré « réservé à l'offre Pro » (ou limite de l'offre Essentiel), avec le lien vers l'abonnement */
export function ProOnlyNotice({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span>{children}</span>
      </p>
      <Link href="/billing" className="shrink-0 font-medium text-primary underline-offset-4 hover:underline">
        Passer à l&apos;offre Pro
      </Link>
    </div>
  )
}
