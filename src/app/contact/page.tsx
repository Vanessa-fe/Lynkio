import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { SupportForm } from '@/components/support/support-form'
import { supportDefaults } from '@/lib/support-defaults'

export const metadata: Metadata = {
  title: 'Contact et aide',
  description: 'Une question sur Filonea, un problème, l’abonnement : écrivez-nous, nous vous répondons par e-mail.',
  alternates: { canonical: '/contact' },
}

export default async function ContactPage() {
  const defaults = await supportDefaults()

  return (
    <div className="min-h-screen bg-cream text-ink">
      <header className="border-b border-ink/[0.07]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 md:px-6">
          <Logo className="text-ink" />
          <Link href={defaults.email ? '/dashboard' : '/'} className="text-sm text-ink/60 hover:text-ink">
            {defaults.email ? 'Retour à mon espace' : 'Retour à l’accueil'}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <h1 className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-tight tracking-[-0.03em]">
          Contact et aide
        </h1>
        <p className="mt-3 max-w-xl text-ink/70">
          Une question avant de vous inscrire, un problème, l&apos;abonnement : écrivez-nous, nous vous répondons par
          e-mail.
        </p>
        <div className="mt-10 rounded-2xl border border-ink/[0.07] bg-card p-6 shadow-soft md:p-8">
          <SupportForm defaultName={defaults.name} defaultEmail={defaults.email} />
        </div>
      </main>
    </div>
  )
}
