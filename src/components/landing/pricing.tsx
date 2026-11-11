'use client'

import { Check, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { FadeIn, RevealWords } from '@/components/motion/reveal'
import { Magnetic } from '@/components/motion/magnetic'
import { SIGNUPS_OPEN } from '@/lib/constants/signup'
import { cn } from '@/lib/utils/cn'
import { pricing } from './content'
import { CtaLink } from './cta-link'
import { SectionLabel } from './section-label'

const euros = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: amount % 1 ? 2 : 0 }).format(
    amount
  )

export function Pricing() {
  const [yearly, setYearly] = useState(false)
  const price = yearly ? pricing.yearly : pricing.monthly

  return (
    <section id="tarifs" className="px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel label="Tarifs" />
          <RevealWords
            text="Un seul abonnement, *tout compris.*"
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <FadeIn>
            <p className="mt-5 text-lg leading-relaxed text-ink/65">
              {pricing.trialDays} jours d&apos;essai gratuit, sans carte bancaire. Sans engagement : vous arrêtez quand
              vous voulez.
            </p>
          </FadeIn>
        </div>

        <FadeIn className="mt-10 flex justify-center">
          <div role="group" aria-label="Période de paiement" className="inline-flex rounded-full border border-ink/10 bg-white p-1 shadow-soft">
            {[
              { value: false, label: 'Mensuel' },
              { value: true, label: 'Annuel · 2 mois offerts' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={yearly === option.value}
                onClick={() => setYearly(option.value)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  yearly === option.value ? 'bg-ink text-cream' : 'text-ink/70 hover:text-ink'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FadeIn>

        <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
          <FadeIn>
            <div className="h-full rounded-[2rem] border border-ink/[0.07] bg-white p-7 shadow-lift md:p-10">
              <h3 className="font-display text-xl font-semibold tracking-tight">Filonea</h3>
              <p className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-6xl font-bold tracking-[-0.04em]">{euros(price)}</span>
                <span className="text-ink/60">{yearly ? 'par an' : 'par mois'}</span>
              </p>
              <p className="mt-1 h-5 text-sm text-ink/55">
                {yearly ? `soit ${euros(pricing.yearly / 12)} par mois` : `ou ${euros(pricing.yearly)} par an`}
              </p>

              <ul className="mt-8 space-y-3">
                {pricing.included.map((item) => (
                  <li key={item} className="flex gap-3 leading-relaxed text-ink/75">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-9">
                {SIGNUPS_OPEN ? (
                  <Magnetic>
                    <CtaLink href="/signup" arrow>
                      {`Essayer ${pricing.trialDays} jours gratuitement`}
                    </CtaLink>
                  </Magnetic>
                ) : (
                  <p className="inline-flex rounded-full bg-brand-50 px-5 py-3 text-sm font-medium text-brand-700">
                    Ouverture des inscriptions très bientôt
                  </p>
                )}
              </div>
            </div>
          </FadeIn>

          <div className="grid grid-cols-1 gap-4">
            <FadeIn delay={0.1}>
              <div className="relative isolate h-full overflow-hidden rounded-[2rem] bg-ink p-7 text-cream md:p-9">
                <div
                  aria-hidden
                  className="absolute -right-24 -top-24 -z-10 size-72 rounded-full opacity-50 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #c9432f 0%, transparent 65%)' }}
                />
                <span className="inline-flex rounded-full border border-cream/20 px-3 py-1 text-xs font-semibold text-peach">
                  {pricing.founders.seats} places
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold tracking-tight">Offre Fondateurs</h3>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-bold tracking-[-0.04em]">{euros(pricing.founders.monthly)}</span>
                  <span className="text-cream/65">par mois, à vie</span>
                </p>
                <p className="mt-4 leading-relaxed text-cream/70">
                  Pour les {pricing.founders.seats} premiers abonnés, en échange de vos retours sur Filonea. Votre prix ne
                  bouge plus, même quand l&apos;outil s&apos;enrichit.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.2}>
              <div className="h-full rounded-[2rem] border border-brand-200 bg-brand-50/60 p-7 md:p-9">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-soft">
                  <KeyRound className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">Votre IA, au prix coûtant</h3>
                <p className="mt-2 leading-relaxed text-ink/70">
                  Sophie rédige avec votre propre compte : OpenAI (quelques centimes par message) ou Gemini de Google
                  (offre gratuite). Filonea ne prend aucune marge dessus.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </div>
    </section>
  )
}
