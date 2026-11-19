'use client'

import { Check } from 'lucide-react'
import { useState } from 'react'
import { FadeIn, RevealWords } from '@/components/motion/reveal'
import { Magnetic } from '@/components/motion/magnetic'
import { SIGNUPS_OPEN } from '@/lib/constants/signup'
import { LEGAL } from '@/lib/constants/legal'
import { cn } from '@/lib/utils/cn'
import { launchOfferEnds, plans, trialDays } from './content'
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
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel label="Tarifs" />
          <RevealWords
            text={`Essayez Filonea Pro\n*gratuitement pendant ${trialDays}\u00a0jours.*`}
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <FadeIn>
            <p className="mt-5 text-lg leading-relaxed text-ink/65">
              Sans carte bancaire. À la fin de l&apos;essai, choisissez l&apos;offre qui vous convient ou arrêtez-vous là.
            </p>
          </FadeIn>
          <FadeIn className="mt-8 flex justify-center">
            {SIGNUPS_OPEN ? (
              <Magnetic>
                <CtaLink href="/signup" variant="primary" arrow>
                  Essayer Pro gratuitement
                </CtaLink>
              </Magnetic>
            ) : (
              <p className="inline-flex rounded-full bg-brand-50 px-5 py-3 text-sm font-medium text-brand-700">
                Ouverture des inscriptions très bientôt
              </p>
            )}
          </FadeIn>
        </div>

        <FadeIn className="mt-14 flex flex-col items-center gap-3">
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
          <p className="max-w-md text-center text-sm text-ink/55">
            {yearly
              ? 'Payé une fois par an. Si vous arrêtez, l’abonnement n’est pas renouvelé : vous gardez l’accès jusqu’à la fin de l’année payée.'
              : 'Sans engagement : vous changez d’offre ou vous arrêtez quand vous voulez. L’arrêt prend effet à la fin du mois payé.'}
          </p>
        </FadeIn>

        <div className="mt-8 grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
          {plans.map((plan, index) => {
            const price = yearly ? plan.yearly : plan.monthly
            const regularPrice = yearly ? plan.regularYearly : plan.regularMonthly
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
                  <p className={cn('mt-1 md:min-h-[3rem]', dark ? 'text-cream/65' : 'text-ink/60')}>{plan.tagline}</p>

                  <p
                    className={cn(
                      'mt-6 inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold',
                      dark ? 'bg-cream/10 text-peach' : 'bg-brand-50 text-brand-700'
                    )}
                  >
                    Prix spécial lancement
                  </p>
                  <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
                    <s className={cn('font-display text-2xl font-semibold', dark ? 'text-cream/40' : 'text-ink/35')}>
                      <span className="sr-only">Au lieu de </span>
                      {euros(regularPrice)}
                    </s>
                    <span className="font-display text-6xl font-bold tracking-[-0.04em]">{euros(price)}</span>
                    <span className={dark ? 'text-cream/65' : 'text-ink/60'}>{yearly ? 'facturés par an' : 'par mois'}</span>
                  </p>
                  <p className={cn('mt-1 h-5 text-sm', dark ? 'text-cream/55' : 'text-ink/55')}>
                    {yearly ? `soit ${euros(plan.yearly / 12)} par mois` : `ou ${euros(plan.yearly)} par an`}
                  </p>

                  <dl
                    className={cn(
                      'mt-7 divide-y rounded-2xl border text-sm',
                      dark ? 'divide-cream/10 border-cream/10 bg-cream/[0.04]' : 'divide-ink/[0.06] border-ink/[0.06] bg-cream'
                    )}
                  >
                    {[
                      { label: 'Recherches', value: plan.searches, tall: true },
                      { label: 'Mots-clés', value: plan.keywords, tall: false },
                    ].map((row) => (
                      <div key={row.label} className="px-4 py-3">
                        <dt className={cn('text-xs font-semibold uppercase tracking-wider', dark ? 'text-peach' : 'text-brand-700')}>
                          {row.label}
                        </dt>
                        <dd className={cn('mt-1 font-medium', row.tall && 'md:min-h-[2.5rem]', dark ? 'text-cream' : 'text-ink')}>{row.value}</dd>
                      </div>
                    ))}
                  </dl>

                  <ul className="mt-7 flex-1 space-y-3">
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

                </div>
              </FadeIn>
            )
          })}
        </div>
        <p className="mt-8 text-center text-sm text-ink/55">
          Prix spécial lancement valable jusqu&apos;au {launchOfferEnds}. Prix en euros. {LEGAL.vat}.
        </p>
      </div>
    </section>
  )
}
