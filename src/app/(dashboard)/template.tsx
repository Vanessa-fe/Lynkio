'use client'

import { motion } from 'motion/react'

/**
 * Chaque changement de rubrique fait apparaître la page en douceur. Fondu seul, sans glissement : un
 * déplacement (transform) de toute la page pouvait laisser Safari et Chrome sur iPhone n'en peindre qu'une
 * partie, le reste vide.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
