'use client'

import { MotionConfig } from 'motion/react'

/** Les animations Motion respectent le réglage « réduire les animations » du système. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
