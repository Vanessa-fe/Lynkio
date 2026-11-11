'use client'

import { Check } from 'lucide-react'
import { useState } from 'react'
import { FadeIn, RevealWords } from '@/components/motion/reveal'
import { Magnetic } from '@/components/motion/magnetic'
import { SIGNUPS_OPEN } from '@/lib/constants/signup'
import { cn } from '@/lib/utils/cn'
import { plans, trialDays } from './content'
import { CtaLink } from './cta-link'
import { SectionLabel } from './section-label'

const euros = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: amount % 1 ? 2 : 0 }).format(
    amount
  )

export function Pricing() {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="tarifs" className="px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <SectionLabel label="Tarifs" />
          <RevealWords
            text="Commencez petit, *visez grand.*"
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <FadeIn>
            <p className="mt-5 text-lg leading-relaxed text-ink/65">
              {trialDays} jours d&apos;essai gratuit de l&apos;offre Pro, sans carte bancaire. Sans engagement : vous
              changez d&apos;offre ou vous arrêtez quand vous voulez.
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

        <div className="mt-8 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {plans.map((plan, index) => {
            const price = yearly ? plan.yearly : plan.monthly
            const dark = plan.highlighted
            return (
              <FadeIn key={plan.key} delay={index * 0.1} className="h-full">
                <div
                  className={cn(
                    'relative isolate flex h-full flex-col overflow-hidden rounded-[2rem] p-7 md:p-9',
                    dark ? 'bg-ink text-cream shadow-lift md:-my-3 md:py-12' : 'border border-ink/[0.07] bg-white shadow-soft'
                  )}
                >
                  {dark && (
                    <div
                      aria-hidden
                      className="absolute -right-24 -top-24 -z-10 size-72 rounded-full opacity-50 blur-3xl"
                      style={{ background: 'radial-gradient(circle, #c9432f 0%, transparent 65%)' }}
                    />
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-display text-2xl font-semibold tracking-tight">{plan.name}</h3>
                    {dark && (
                      <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-cream">Recommandée</span>
                    )}
                  </div>
                  <p className={cn('mt-1', dark ? 'text-cream/65' : 'text-ink/60')}>{plan.tagline}</p>

                  <p className="mt-6 flex items-baseline gap-2">
                    <span className="font-display text-6xl font-bold tracking-[-0.04em]">{euros(price)}</span>
                    <span className={dark ? 'text-cream/65' : 'text-ink/60'}>{yearly ? 'par an' : 'par mois'}</span>
                  </p>
                  <p className={cn('mt-1 h-5 text-sm', dark ? 'text-cream/55' : 'text-ink/55')}>
                    {yearly ? `soit ${euros(plan.yearly / 12)} par mois` : `ou ${euros(plan.yearly)} par an`}
                  </p>

                  <ul className="mt-8 flex-1 space-y-3">
                    {plan.features.map((feature, featureIndex) => {
                      // « Tout Essentiel, et : » introduit la liste de Pro, sans coche
                      const intro = dark && featureIndex === 0
                      return (
                        <li
                          key={feature}
                          className={cn('flex gap-3 leading-relaxed', dark ? 'text-cream/80' : 'text-ink/75', intro && 'font-semibold')}
                        >
                          {!intro && (
                            <span
                              className={cn(
                                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                                dark ? 'bg-cream/10 text-peach' : 'bg-brand-50 text-brand-600'
                              )}
                            >
                              <Check className="size-3.5" strokeWidth={3} aria-hidden />
                            </span>
                          )}
                          {feature}
                        </li>
                      )
                    })}
                  </ul>

                  <div className="mt-9">
                    {SIGNUPS_OPEN ? (
                      <Magnetic>
                        <CtaLink href={`/signup?offre=${plan.key}`} variant={dark ? 'primary' : 'outline'} arrow={dark}>
                          {dark ? `Essayer ${trialDays} jours gratuitement` : 'Choisir Essentiel'}
                        </CtaLink>
                      </Magnetic>
                    ) : (
                      <p
                        className={cn(
                          'inline-flex rounded-full px-5 py-3 text-sm font-medium',
                          dark ? 'bg-cream/10 text-peach' : 'bg-brand-50 text-brand-700'
                        )}
                      >
                        Ouverture des inscriptions très bientôt
                      </p>
                    )}
                  </div>
                </div>
              </FadeIn>
            )
          })}
        </div>
      </div>
    </section>
  )
}
