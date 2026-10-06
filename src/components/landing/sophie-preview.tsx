'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bell, Pause, Play, ScanSearch, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Counter } from '@/components/motion/counter'
import { easeOutExpo } from '@/components/motion/reveal'
import { Tilt } from '@/components/motion/tilt'
import { examples, type Example } from './content'

const CYCLE_MS = 8000

/** Message qui s'écrit lettre par lettre, comme si Sophie le rédigeait. */
function TypedText({ text, className }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (reduce) return
    let interval: number | undefined
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setCount((c) => {
          if (c >= text.length) {
            window.clearInterval(interval)
            return c
          }
          return c + 2
        })
      }, 22)
    }, 900)
    return () => {
      window.clearTimeout(start)
      window.clearInterval(interval)
    }
  }, [text, reduce])

  const shown = reduce ? text : text.slice(0, count)
  const typing = !reduce && count < text.length

  return (
    <p className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {shown}
        {typing && <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse bg-brand-500" />}
      </span>
    </p>
  )
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="27" fill="none" strokeWidth="6" className="stroke-brand-100" />
        <motion.circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          className="stroke-brand-500"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: score / 100 }}
          transition={{ duration: 1.4, ease: easeOutExpo, delay: 0.25 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <Counter to={score} play delay={0.25} duration={1.4} className="font-display text-lg font-bold tabular-nums" />
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">score</span>
      </div>
    </div>
  )
}

function ExampleCard({ example }: { example: Example }) {
  const SegmentIcon = example.segmentIcon
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12, transition: { duration: 0.3 } }}
      transition={{ duration: 0.6, ease: easeOutExpo }}
      className="space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold tracking-tight">{example.company}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{example.meta}</p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
            <SegmentIcon className="size-3.5" />
            {example.segment}
          </span>
        </div>
        <ScoreRing score={example.score} />
      </div>

      <ul className="space-y-2">
        {example.signals.map((signal, i) => {
          const Icon = signal.icon
          return (
            <motion.li
              key={signal.title}
              className="flex items-start gap-3 rounded-xl bg-muted/70 p-3"
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: easeOutExpo, delay: 0.3 + i * 0.12 }}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-sm">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-medium">{signal.title}</p>
                <p className="truncate text-muted-foreground">{signal.detail}</p>
              </div>
            </motion.li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {example.badges.map((badge, i) => (
          <motion.span
            key={badge}
            className="rounded-full border px-2.5 py-0.5 text-xs font-medium text-ink/70"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 20, delay: 0.55 + i * 0.06 }}
          >
            {badge}
          </motion.span>
        ))}
      </div>

      <div className="rounded-xl border border-brand-100 bg-brand-50/60 p-3.5">
        <p className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          <Sparkles className="size-4 text-brand-600" />
          Message préparé par Sophie
        </p>
        <TypedText text={example.message} className="min-h-[4.5rem] text-sm leading-relaxed text-ink/70" />
      </div>
    </motion.div>
  )
}

/**
 * Carte vivante du hero : Sophie présente tour à tour une piste par cible
 * (PME, agence, startup). Entreprises fictives.
 */
export function SophiePreview() {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const running = !reduce && !paused && !hovered
  const current = examples[index]

  useEffect(() => {
    if (!running) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % examples.length), CYCLE_MS)
    return () => window.clearTimeout(id)
  }, [running, index])

  return (
    <div
      className="relative"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* Pastilles flottantes autour de la carte */}
      <motion.div
        aria-hidden
        className="absolute -top-5 left-8 z-10 hidden lg:block"
        initial={{ opacity: 0, scale: 0.6, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 1.1 }}
      >
        <div className="flex animate-bob items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-xs font-medium text-cream shadow-lift">
          <span className="size-2 animate-pulse-dot rounded-full bg-brand-400" />
          3 nouvelles pistes ce matin
        </div>
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute -bottom-6 -right-6 z-10 hidden lg:block"
        initial={{ opacity: 0, scale: 0.6, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 1.3 }}
      >
        <div className="flex animate-bob items-center gap-2 rounded-full border bg-white px-3.5 py-2 text-xs font-medium shadow-lift [animation-delay:-2.5s]">
          <Bell className="size-3.5 text-brand-600" />
          Relance prévue demain, 9 h
        </div>
      </motion.div>

      <Tilt className="rounded-[1.75rem]">
        <div
          className="relative rounded-[1.75rem] border border-ink/[0.07] bg-white p-5 shadow-lift sm:p-6"
          role="region"
          aria-roledescription="carrousel"
          aria-label="Exemples de fiches préparées par Sophie"
        >
          <div className="mb-5 flex items-center justify-between gap-3 border-b pb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex size-9 items-center justify-center rounded-full bg-brand-600 text-cream">
                <ScanSearch className="size-[18px]" />
                <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse-dot rounded-full border-2 border-white bg-brand-400" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold">Sophie</p>
                <p className="text-xs text-muted-foreground">a trouvé une piste</p>
              </div>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Exemple fictif</span>
          </div>

          <div aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {current && <ExampleCard key={current.company} example={current} />}
            </AnimatePresence>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <div className="flex flex-1 gap-1.5">
              {examples.map((example, i) => (
                <button
                  key={example.company}
                  type="button"
                  onClick={() => setIndex(i)}
                  className="group relative h-6 flex-1"
                  aria-label={`Voir l'exemple ${example.segment}`}
                  aria-current={i === index}
                >
                  <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
                    {i === index && (
                      <motion.span
                        key={`${index}-${running}`}
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-500"
                        initial={{ width: running ? '0%' : '100%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: running ? CYCLE_MS / 1000 : 0, ease: 'linear' }}
                      />
                    )}
                    {i < index && <span className="absolute inset-0 bg-brand-200" />}
                  </span>
                </button>
              ))}
            </div>
            {!reduce && (
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={paused ? 'Reprendre le défilement' : 'Mettre en pause le défilement'}
              >
                {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
              </button>
            )}
          </div>
        </div>
      </Tilt>
    </div>
  )
}
