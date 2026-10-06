'use client'

import { Check } from 'lucide-react'
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

const liveSignals = [
  { label: 'Offre publiée', detail: '« Chargé·e de projet web »' },
  { label: 'Mission freelance', detail: '« Refonte du site vitrine »' },
  { label: 'Entreprise créée', detail: 'il y a 5 jours · Rennes' },
]

function SignalsVisual() {
  return (
    <ul className="space-y-2">
      {liveSignals.map((signal, i) => (
        <motion.li
          key={signal.label}
          className="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-cream px-4 py-3 text-sm"
          initial={{ opacity: 0, x: 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={inView}
          transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.2 + i * 0.15 }}
        >
          <span className="size-2 shrink-0 animate-pulse-dot rounded-full bg-brand-500" style={{ animationDelay: `${i * 0.6}s` }} />
          <span className="font-medium">{signal.label}</span>
          <span className="truncate text-ink/55">{signal.detail}</span>
        </motion.li>
      ))}
    </ul>
  )
}

const stack = ['WordPress', 'Next.js', 'Shopify', 'Vue', 'React']

function TechVisual() {
  return (
    <div className="flex flex-wrap gap-2">
      {stack.map((tech, i) => {
        const match = tech === 'Next.js'
        return (
          <motion.span
            key={tech}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm',
              match ? 'border-brand-600 bg-brand-600 font-medium text-cream' : 'border-ink/10 text-ink/45'
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: match ? [0.8, 1.12, 1] : 1 }}
            viewport={inView}
            transition={{ duration: match ? 0.7 : 0.4, delay: match ? 0.7 : 0.15 + i * 0.06 }}
          >
            {match && <Check className="size-3.5" />}
            {tech}
          </motion.span>
        )
      })}
    </div>
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
  ['SIREN', '123 456 789'],
  ['Dirigeante', 'Claire M.'],
  ['Site', 'Next.js'],
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

const stages = ['À contacter', 'Contacté', 'A répondu', 'Gagné']

function PipelineVisual() {
  return (
    <ol className="relative space-y-2.5">
      {stages.map((stage, i) => (
        <motion.li
          key={stage}
          className="flex items-center gap-3 text-sm"
          initial={{ opacity: 0.3 }}
          whileInView={{ opacity: 1 }}
          viewport={inView}
          transition={{ delay: 0.3 + i * 0.35, duration: 0.4 }}
        >
          <motion.span
            className="flex size-6 items-center justify-center rounded-full border-2 border-brand-200 bg-white"
            initial={{ backgroundColor: '#ffffff', borderColor: '#f8cfc6' }}
            whileInView={{ backgroundColor: '#c9432f', borderColor: '#c9432f' }}
            viewport={inView}
            transition={{ delay: 0.3 + i * 0.35, duration: 0.4 }}
          >
            <Check className="size-3.5 text-white" />
          </motion.span>
          <span className="font-medium">{stage}</span>
        </motion.li>
      ))}
    </ol>
  )
}

const checks = ['Aucun lien inconnu', 'Aucun champ à compléter', 'Aucun prix annoncé']

function MessagesVisual() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr] md:items-center">
      <div className="rounded-2xl border border-ink/[0.06] bg-cream p-4 text-sm leading-relaxed text-ink/70">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-700">Brouillon · LinkedIn</p>
        Bonjour Claire, j&apos;ai vu que vous recrutez un·e chargé·e de projet web pour faire évoluer votre boutique en
        ligne. En attendant le bon profil, je peux prendre en main un projet précis, à distance…
      </div>
      <ul className="space-y-2">
        {checks.map((check, i) => (
          <motion.li
            key={check}
            className="flex items-center gap-2.5 text-sm font-medium"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={inView}
            transition={{ duration: 0.5, ease: easeOutExpo, delay: 0.4 + i * 0.2 }}
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <Check className="size-3.5" />
            </span>
            {check}
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

export function Features() {
  return (
    <section id="fonctionnalites" className="px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <SectionLabel index="02" label="Fonctionnalités" className="text-brand-700" />
          <RevealWords
            text="Prospecter sans y passer *vos journées.*"
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink/65">
            Sophie fait le repérage et la préparation. Vous gardez le meilleur rôle : choisir à qui écrire.
          </p>
        </div>

        <Stagger className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" stagger={0.1}>
          <FeatureCard feature={features.signals} className="md:col-span-2">
            <SignalsVisual />
          </FeatureCard>
          <FeatureCard feature={features.tech}>
            <TechVisual />
          </FeatureCard>
          <FeatureCard feature={features.score}>
            <ScoreVisual />
          </FeatureCard>
          <FeatureCard feature={features.records}>
            <RecordsVisual />
          </FeatureCard>
          <FeatureCard feature={features.pipeline}>
            <PipelineVisual />
          </FeatureCard>
          <FeatureCard feature={features.messages} className="md:col-span-2 lg:col-span-3">
            <MessagesVisual />
          </FeatureCard>
        </Stagger>
      </div>
    </section>
  )
}
