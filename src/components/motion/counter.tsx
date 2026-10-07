'use client'

import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import { easeOutExpo } from './reveal'

/** Nombre qui défile de `from` à `to` à l'entrée dans l'écran (ou quand `play` passe à true). */
export function Counter({
  from = 0,
  to,
  suffix = '',
  delay = 0,
  duration = 1.6,
  play,
  className,
}: {
  from?: number
  to: number
  suffix?: string
  delay?: number
  duration?: number
  play?: boolean
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const active = play ?? inView
  const value = useMotionValue(from)
  const display = useTransform(value, (v) => `${Math.round(v)}${suffix}`)

  useEffect(() => {
    if (!active) return
    value.set(from)
    const controls = animate(value, to, { duration, delay, ease: easeOutExpo })
    return () => controls.stop()
  }, [active, value, from, to, delay, duration])

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">
        {to}
        {suffix}
      </span>
      <motion.span aria-hidden>{display}</motion.span>
    </span>
  )
}
