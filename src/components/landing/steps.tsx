'use client'

import { motion, useInView, useScroll, useSpring } from 'motion/react'
import { useRef } from 'react'
import { easeOutExpo, RevealWords } from '@/components/motion/reveal'
import { cn } from '@/lib/utils/cn'
import { steps } from './content'
import { SectionLabel } from './section-label'

function Step({ step, index }: { step: (typeof steps)[number]; index: number }) {
  const ref = useRef<HTMLLIElement>(null)
  const active = useInView(ref, { margin: '-45% 0px -45% 0px' })
  const seen = useInView(ref, { once: true, margin: '0px 0px -20% 0px' })

  return (
    <motion.li
      ref={ref}
      className="relative pl-16 md:pl-24"
      initial={{ opacity: 0, y: 30 }}
      animate={seen ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: easeOutExpo }}
    >
      <span
        className={cn(
          'absolute left-0 top-1 flex size-10 items-center justify-center rounded-full border-2 transition-colors duration-500 md:left-2 md:size-12',
          active ? 'border-brand-600 bg-brand-600' : 'border-brand-200 bg-cream'
        )}
      >
        <span
          className={cn(
            'size-2.5 rounded-full transition-colors duration-500',
            active ? 'bg-cream' : 'bg-brand-200'
          )}
        />
      </span>
      <div
        className={cn(
          'rounded-3xl border bg-white p-6 shadow-soft transition-all duration-500 md:p-8',
          active ? 'border-brand-200 shadow-lift' : 'border-ink/[0.07]'
        )}
      >
        <span
          className={cn(
            'block font-display text-6xl font-bold leading-none tracking-[-0.06em] transition-colors duration-500 md:text-7xl',
            active ? 'text-brand-200' : 'text-brand-100'
          )}
        >
          0{index + 1}
        </span>
        <h3 className="mt-4 font-display text-2xl font-semibold tracking-tight md:text-3xl">{step.title}</h3>
        <p className="mt-2 text-lg leading-relaxed text-ink/65">{step.text}</p>
      </div>
    </motion.li>
  )
}

/** Trois étapes sur une ligne qui se remplit au fil du scroll. */
export function Steps() {
  const listRef = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 0.6', 'end 0.6'] })
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })

  return (
    <section id="comment-ca-marche" className="px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-14 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionLabel label="Comment ça marche" />
          <RevealWords
            text="Trois étapes, et Sophie *s’occupe du reste.*"
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <p className="mt-5 max-w-md text-lg leading-relaxed text-ink/65">
            Quelques minutes de réglages au départ. Ensuite, des pistes notées arrivent toutes seules, avec de quoi
            écrire.
          </p>
        </div>

        <ol ref={listRef} className="relative space-y-6 md:space-y-8">
          <span aria-hidden className="absolute bottom-8 left-5 top-8 w-0.5 rounded-full bg-brand-100 md:left-8" />
          <motion.span
            aria-hidden
            className="absolute bottom-8 left-5 top-8 w-0.5 origin-top rounded-full bg-brand-500 md:left-8"
            style={{ scaleY: fill }}
          />
          {steps.map((step, i) => (
            <Step key={step.title} step={step} index={i} />
          ))}
        </ol>
      </div>
    </section>
  )
}
