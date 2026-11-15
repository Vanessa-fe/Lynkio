'use client'

import { motion } from 'motion/react'
import { easeOutExpo } from './reveal'

/** Barre de progression qui se remplit à l'entrée dans l'écran. */
export function GrowBar({ percent, color, delay = 0 }: { percent: number; color: string; delay?: number }) {
  return (
    <motion.span
      className="block h-full rounded-full"
      style={{ backgroundColor: color }}
      initial={{ width: 0 }}
      whileInView={{ width: `${percent}%` }}
      viewport={{ once: true }}
      transition={{ duration: 0.9, delay, ease: easeOutExpo }}
    />
  )
}
