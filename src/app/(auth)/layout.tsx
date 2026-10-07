import type { Metadata } from 'next'
import { Check } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

export const metadata: Metadata = {
  title: 'Connexion - Filonea',
  description: 'Connectez-vous à votre compte Filonea',
}

const promises = [
  'Des entreprises repérées sur des signaux d’achat',
  'Un score sur 100 selon votre client idéal',
  'Un premier message prêt à relire',
]

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[1fr_1.1fr]">
      {/* Panneau de marque, à gauche sur grand écran */}
      <aside className="relative isolate hidden overflow-hidden bg-wine p-12 text-cream lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute -left-32 -top-32 -z-10 size-[34rem] animate-float rounded-full opacity-50 blur-3xl"
          style={{ background: 'radial-gradient(circle, #c9432f 0%, transparent 65%)' }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -right-32 -z-10 size-[30rem] animate-float rounded-full opacity-30 blur-3xl [animation-delay:-5s]"
          style={{ background: 'radial-gradient(circle, #fbd3bf 0%, transparent 65%)' }}
        />

        <Logo className="text-cream" />

        <div className="max-w-md">
          <p className="font-display text-5xl font-bold leading-[1.05] tracking-[-0.045em]">
            Sophie repère, <span className="accent-serif text-brand-300">vous choisissez.</span>
          </p>
          <ul className="mt-10 space-y-4">
            {promises.map((promise) => (
              <li key={promise} className="flex items-center gap-3 text-cream/80">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600/30 text-brand-300">
                  <Check className="size-4" />
                </span>
                {promise}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-cream/50">L&apos;outil de prospection des freelances.</p>
      </aside>

      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md animate-slide-in-bottom">
          <Logo className="mb-8 justify-center lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  )
}
