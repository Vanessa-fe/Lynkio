'use client'

import { ArrowRight, Check, X } from 'lucide-react'
import { motion } from 'motion/react'
import { easeOutExpo, RevealWords } from '@/components/motion/reveal'
import { beforeAfter } from './content'
import { SectionLabel } from './section-label'

const inView = { once: true, margin: '0px 0px -20% 0px' } as const

/** Le constat : la prospection à l'aveugle se barre, la version avec Sophie se coche. */
export function BeforeAfter() {
  const { before, after } = beforeAfter

  return (
    <section className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <SectionLabel label="Le constat" />
          <RevealWords
            text={beforeAfter.title}
            accentClassName="text-brand-600"
            className="mt-6 text-balance font-display text-[clamp(2.1rem,4.4vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.045em]"
          />
        </div>

        <div className="relative mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {/* À l'aveugle */}
          <div className="rounded-3xl border border-ink/[0.07] bg-muted/60 p-6 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink/45">{before.label}</p>
            <ul className="mt-6 space-y-4">
              {before.items.map((item, i) => (
                <li key={item} className="flex items-start gap-3 text-ink/55">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-ink/[0.06]">
                    <X className="size-3.5" />
                  </span>
                  <span className="relative text-lg leading-snug">
                    {item}
                    {/* Trait qui barre la ligne */}
                    <motion.span
                      aria-hidden
                      className="absolute left-0 top-[0.7em] h-[1.5px] w-full origin-left bg-ink/35"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={inView}
                      transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.3 + i * 0.25 }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pastille de passage entre les deux colonnes */}
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 z-10 hidden size-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-brand-600 text-cream shadow-lift md:flex"
          >
            <ArrowRight className="size-5" />
          </div>

          {/* Avec Sophie */}
          <div className="rounded-3xl border border-brand-200 bg-white p-6 shadow-lift md:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-700">{after.label}</p>
            <ul className="mt-6 space-y-4">
              {after.items.map((item, i) => (
                <motion.li
                  key={item}
                  className="flex items-start gap-3"
                  initial={{ opacity: 0, x: 16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={inView}
                  transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.5 + i * 0.25 }}
                >
                  <motion.span
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-cream"
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={inView}
                    transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.6 + i * 0.25 }}
                  >
                    <Check className="size-3.5" />
                  </motion.span>
                  <span className="text-lg font-medium leading-snug">{item}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
