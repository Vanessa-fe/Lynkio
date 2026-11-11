import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import { LEGAL } from '@/lib/constants/legal'

const LINKS = [
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/conditions', label: 'Conditions générales' },
  { href: '/confidentialite', label: 'Confidentialité' },
]

/**
 * Mise en page commune des pages légales : texte lisible, titres et listes stylés sans plugin
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-ink/[0.07]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 md:px-6">
          <Logo className="text-ink" />
          <Link href="/" className="text-sm text-ink/60 hover:text-ink">
            Retour à l&apos;accueil
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight tracking-[-0.03em]">{title}</h1>
        <p className="mt-3 text-sm text-ink/55">Dernière mise à jour : {LEGAL.updatedAt}</p>
        <div className="mt-10 space-y-4 leading-relaxed text-ink/80 [&_a]:text-brand-700 [&_a]:underline [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-ink [&_li]:mt-1 [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
          {children}
        </div>
        <nav aria-label="Pages légales" className="mt-16 flex flex-wrap gap-x-6 gap-y-2 border-t border-ink/[0.07] pt-6 text-sm text-ink/60">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      </main>
    </div>
  )
}
