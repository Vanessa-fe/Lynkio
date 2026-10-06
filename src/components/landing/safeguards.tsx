'use client'

import { motion } from 'motion/react'
import { Counter } from '@/components/motion/counter'
import { easeOutExpo, FadeIn, RevealWords } from '@/components/motion/reveal'
import { safeguards } from './content'
import { SectionLabel } from './section-label'

/** Coche qui se dessine à l'entrée dans l'écran. */
function DrawnCheck({ delay }: { delay: number }) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600/20 text-brand-300">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: '0px 0px -15% 0px' }}
          transition={{ duration: 0.7, ease: easeOutExpo, delay }}
        />
      </svg>
    </span>
  )
}

export function Safeguards() {
  return (
    <section id="fiabilite" className="px-3 py-8 md:px-6">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-wine px-5 py-20 text-cream md:rounded-[2.5rem] md:px-12 md:py-28">
        <div
          aria-hidden
          className="absolute -right-40 -top-40 -z-10 size-[36rem] animate-float rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #c9432f 0%, transparent 65%)' }}
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionLabel label="Fiabilité" tone="dark" />
            <RevealWords
              text="L’IA propose, *le code vérifie.*"
              accentClassName="text-brand-300"
              className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
            />
            <FadeIn>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-cream/70">
                Une IA peut se tromper avec beaucoup d&apos;assurance. Sophie s&apos;en sert pour chercher et rédiger,
                jamais pour décider seule.
              </p>
            </FadeIn>
            <FadeIn delay={0.15} className="mt-10 flex items-end gap-4 border-t border-cream/15 pt-8">
              <Counter to={100} suffix={"\u00a0%"} className="font-display text-6xl font-bold tracking-[-0.04em] text-cream md:text-7xl" />
              <p className="max-w-[12rem] pb-2 text-sm leading-snug text-cream/60">des messages relus par vous avant l&apos;envoi</p>
            </FadeIn>
          </div>

          <ul className="space-y-3">
            {safeguards.map((item, i) => (
              <FadeIn key={item.title} as="li" delay={i * 0.12}>
                <div className="flex gap-4 rounded-3xl border border-cream/10 bg-cream/[0.04] p-5 backdrop-blur-sm transition-colors duration-500 hover:bg-cream/[0.08] md:p-6">
                  <DrawnCheck delay={0.3 + i * 0.15} />
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-1 leading-relaxed text-cream/65">{item.text}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
