'use client'

import { motion } from 'motion/react'
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
    <section id="transparence" className="px-3 py-8 md:px-6">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-wine px-5 py-14 text-cream md:rounded-[2.5rem] md:px-12 md:py-20">
        <div
          aria-hidden
          className="absolute -right-40 -top-40 -z-10 size-[36rem] animate-float rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(circle, #c9432f 0%, transparent 65%)' }}
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <SectionLabel label="En toute transparence" tone="dark" />
            <RevealWords
              text={'Des sources publiques.\n*Vous décidez quoi envoyer.*'}
              accentClassName="text-brand-300"
              className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
            />
          </div>

          <ul className="space-y-3">
            {safeguards.map((item, i) => (
              <FadeIn key={item.title} as="li" delay={i * 0.12}>
                <div className="flex gap-4 rounded-3xl border border-cream/10 bg-cream/[0.04] p-5 backdrop-blur-sm transition-colors duration-500 hover:bg-cream/[0.08] md:p-6">
                  <DrawnCheck delay={0.3 + i * 0.15} />
                  <div>
                    <h3 className="font-display text-lg font-semibold tracking-tight">{item.title}</h3>
                    <p className="mt-1 leading-relaxed text-cream/65">{item.text}</p>
                    {item.example && (
                      <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-cream/15 bg-cream/[0.06] px-3 py-1 text-sm text-cream/85">
                        <span className="size-1.5 rounded-full bg-brand-300" />
                        {item.example}
                      </span>
                    )}
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
