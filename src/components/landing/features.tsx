'use client'

import { Bell } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Counter } from '@/components/motion/counter'
import { easeOutExpo, RevealWords, Stagger, StaggerItem } from '@/components/motion/reveal'
import { cn } from '@/lib/utils/cn'
import { features, type Feature } from './content'
import { SectionLabel } from './section-label'

const inView = { once: true, margin: '0px 0px -15% 0px' } as const

/** Carte avec un halo corail qui suit la souris. */
function FeatureCard({ feature, className, children }: { feature: Feature; className?: string; children?: ReactNode }) {
  const Icon = feature.icon
  return (
    <StaggerItem className={cn('h-full', className)}>
      <article
        className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-ink/[0.07] bg-white p-6 shadow-soft transition-shadow duration-500 hover:shadow-lift md:p-7"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`)
          e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`)
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: 'radial-gradient(420px circle at var(--x) var(--y), rgb(234 126 104 / 0.12), transparent 60%)' }}
        />
        <span className="relative flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 transition-transform duration-500 ease-out-expo group-hover:-rotate-6 group-hover:scale-110">
          <Icon className="size-5" />
        </span>
        <h3 className="relative mt-5 font-display text-xl font-semibold tracking-tight">{feature.title}</h3>
        <p className="relative mt-2 leading-relaxed text-ink/65">{feature.text}</p>
        {children && <div className="relative mt-6 flex-1">{children}</div>}
      </article>
    </StaggerItem>
  )
}

function ScoreVisual() {
  return (
    <div>
      <p className="font-display text-5xl font-bold tracking-tight text-ink">
        <Counter to={82} />
        <span className="text-2xl text-ink/35">/100</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-50">
        <motion.div
          className="h-full origin-left rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 0.82 }}
          viewport={inView}
          transition={{ duration: 1.6, ease: easeOutExpo }}
        />
      </div>
    </div>
  )
}

const recordRows = [
  ['Dirigeante', 'Claire M. · Fondatrice'],
  ['LinkedIn', 'Profil trouvé'],
]

function RecordsVisual() {
  return (
    <dl className="divide-y divide-ink/[0.06] rounded-2xl border border-ink/[0.06] bg-cream text-sm">
      {recordRows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-3 px-4 py-2.5">
          <dt className="text-ink/50">{label}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PipelineVisual() {
  return (
    <motion.div
      className="flex items-start gap-3 rounded-2xl border border-ink/[0.06] bg-cream p-4 text-sm"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={inView}
      transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.3 }}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Bell className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="font-medium">Cabinet de recrutement</p>
        <p className="mt-0.5 text-ink/55">Message LinkedIn envoyé il y a 5 jours</p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-medium text-cream">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-cream" />
          À relancer aujourd&apos;hui
        </span>
      </div>
    </motion.div>
  )
}

function MessagesVisual() {
  return (
    <div className="space-y-3">
      <motion.p
        className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-2xl border border-ink/[0.06] bg-white px-4 py-3 text-sm"
        initial={{ opacity: 0, x: 30 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={inView}
        transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.2 }}
      >
        <span className="size-2 shrink-0 animate-pulse-dot rounded-full bg-brand-500" />
        <span className="whitespace-nowrap font-medium">Entreprise créée récemment</span>
        <span className="pl-5 text-ink/55 sm:pl-0">Cabinet de recrutement · Rennes</span>
      </motion.p>
      <motion.div
        className="rounded-2xl border border-ink/[0.06] bg-cream p-4 text-sm leading-relaxed text-ink/70"
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={inView}
        transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.5 }}
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">Message proposé · LinkedIn</p>
        Bonjour Claire, j&apos;ai vu que vous veniez de lancer votre cabinet. Si vous prévoyez de publier vos offres sur
        votre propre site, je peux vous aider à mettre en place une page simple pour recevoir les candidatures. Est-ce un
        sujet que vous avez déjà prévu ?
      </motion.div>
    </div>
  )
}

export function Features() {
  return (
    <section id="fonctionnalites" className="px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <SectionLabel label="Fonctionnalités" />
          <RevealWords
            text="Prospecter sans y passer *vos journées.*"
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/65">
            Voyez quelles entreprises contacter en priorité, trouvez un point de départ pour leur écrire et gardez le fil de
            vos relances.
          </p>
        </div>

        <Stagger className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3" stagger={0.1}>
          <FeatureCard feature={features.messages} className="md:col-span-2">
            <MessagesVisual />
          </FeatureCard>
          <FeatureCard feature={features.score}>
            <ScoreVisual />
          </FeatureCard>
          <FeatureCard feature={features.records} className="md:col-span-2">
            <RecordsVisual />
          </FeatureCard>
          <FeatureCard feature={features.pipeline}>
            <PipelineVisual />
          </FeatureCard>
        </Stagger>
      </div>
    </section>
  )
}
