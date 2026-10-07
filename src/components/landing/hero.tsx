'use client'

import { ShieldCheck } from 'lucide-react'
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import { useRef } from 'react'
import { Magnetic } from '@/components/motion/magnetic'
import { easeOutExpo, RevealWords } from '@/components/motion/reveal'
import { SIGNUPS_CLOSED_MESSAGE, SIGNUPS_OPEN } from '@/lib/constants/signup'
import { cn } from '@/lib/utils/cn'
import { hero } from './content'
import { CtaLink } from './cta-link'
import { SophiePreview } from './sophie-preview'

// Halo chaud derrière le contenu : corail, pêche et rose pâle, jamais de rouge plein
const blobs = [
  {
    className: '-right-[20%] -top-[25%] size-[60vmax]',
    background: 'radial-gradient(circle at center, #ea7e68 0%, #f2ab9c66 40%, transparent 70%)',
    opacity: 0.55,
  },
  {
    className: '-left-[25%] top-[20%] size-[50vmax]',
    background: 'radial-gradient(circle at center, #fbd3bf 0%, #fbe6e188 45%, transparent 70%)',
    opacity: 0.9,
  },
  {
    className: '-bottom-[35%] right-[15%] size-[40vmax]',
    background: 'radial-gradient(circle at center, #f8cfc6 0%, #fdf4f266 45%, transparent 70%)',
    opacity: 0.8,
  },
]

/** Entrée en CSS : le premier écran reste lisible même si le JavaScript tarde. */
function Appear({ children, delay, className }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <div className={cn('animate-fade-up', className)} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  )
}

export function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '18%'])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.9], [1, 0])
  const blobsY = useTransform(scrollYProgress, [0, 1], ['0%', '35%'])

  // Les halos suivent doucement la souris
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, { stiffness: 40, damping: 18 })
  const sy = useSpring(my, { stiffness: 40, damping: 18 })
  const parallax = [
    { x: useTransform(sx, (v) => v * 70), y: useTransform(sy, (v) => v * 50) },
    { x: useTransform(sx, (v) => v * -90), y: useTransform(sy, (v) => v * -60) },
    { x: useTransform(sx, (v) => v * 40), y: useTransform(sy, (v) => v * -70) },
  ]

  return (
    <section
      ref={ref}
      id="haut"
      className="relative isolate overflow-hidden px-4 pb-20 pt-32 md:px-6 md:pb-28 md:pt-40"
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        mx.set(e.clientX / window.innerWidth - 0.5)
        my.set(e.clientY / window.innerHeight - 0.5)
      }}
    >
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ y: blobsY }}>
        {blobs.map((blob, i) => (
          <motion.div
            key={i}
            className={`absolute ${blob.className}`}
            style={parallax[i]}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: blob.opacity }}
            transition={{ duration: 2 + i * 0.2, ease: easeOutExpo, delay: i * 0.15 }}
          >
            <div
              className="size-full animate-float rounded-full blur-3xl"
              style={{ background: blob.background, animationDuration: `${12 + i * 3}s`, animationDelay: `${-i * 2}s` }}
            />
          </motion.div>
        ))}
      </motion.div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-b from-transparent to-cream" />

      <motion.div
        className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[1.2fr_1fr] lg:gap-12"
        style={{ y: contentY, opacity: contentOpacity }}
      >
        <div>
          <Appear delay={0.05}>
            <p className="inline-flex items-center gap-2.5 rounded-full border border-ink/10 bg-white/60 px-4 py-2 text-xs font-medium text-ink/80 backdrop-blur md:text-sm">
              <span className="size-2 shrink-0 animate-pulse-dot rounded-full bg-brand-500" />
              {hero.eyebrow}
            </p>
          </Appear>

          <RevealWords
            as="h1"
            text={hero.title}
            immediate
            delay={0.15}
            stagger={0.045}
            accentClassName="text-brand-600"
            className="mt-7 text-balance font-display text-[clamp(2.5rem,5.2vw,4.1rem)] font-bold leading-[1.04] tracking-[-0.04em] text-ink"
          />

          <Appear delay={0.6}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink/70">{hero.intro}</p>
          </Appear>

          <Appear delay={0.75} className="mt-9 flex flex-wrap items-center gap-3">
            {SIGNUPS_OPEN ? (
              <>
                <Magnetic>
                  <CtaLink href="/signup" arrow>
                    Créer mon compte
                  </CtaLink>
                </Magnetic>
                <Magnetic>
                  <CtaLink href="/login" variant="outline">
                    J&apos;ai déjà un compte
                  </CtaLink>
                </Magnetic>
              </>
            ) : (
              <Magnetic>
                <CtaLink href="/login" arrow>
                  Se connecter
                </CtaLink>
              </Magnetic>
            )}
          </Appear>

          <Appear delay={0.9}>
            <p className="mt-6 flex items-center gap-2 text-sm text-ink/60">
              <ShieldCheck className="size-4 shrink-0 text-brand-600" />
              {SIGNUPS_OPEN ? hero.reassurance : `${SIGNUPS_CLOSED_MESSAGE} Lynkio est en test privé.`}
            </p>
          </Appear>
        </div>

        <Appear delay={0.4} className="[--fade-up-from:40px] [animation-duration:1.2s]">
          <SophiePreview />
        </Appear>
      </motion.div>
    </section>
  )
}
