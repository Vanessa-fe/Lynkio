'use client'

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Carte qui pivote légèrement en 3D vers la souris, avec un reflet qui suit le curseur. */
export function Tilt({ children, className, max = 6 }: { children: ReactNode; className?: string; max?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const spring = { stiffness: 220, damping: 22, mass: 0.6 }
  const rotateX = useSpring(0, spring)
  const rotateY = useSpring(0, spring)
  const glareX = useMotionValue(50)
  const glareY = useMotionValue(50)
  const glareOpacity = useSpring(0, spring)
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgb(255 255 255 / 0.35), transparent 55%)`

  return (
    <motion.div
      ref={ref}
      className={cn('relative', className)}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onPointerMove={(e) => {
        if (reduce || e.pointerType !== 'mouse' || !ref.current) return
        const r = ref.current.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width
        const py = (e.clientY - r.top) / r.height
        rotateY.set((px - 0.5) * max * 2)
        rotateX.set((0.5 - py) * max * 2)
        glareX.set(px * 100)
        glareY.set(py * 100)
        glareOpacity.set(1)
      }}
      onPointerLeave={() => {
        rotateX.set(0)
        rotateY.set(0)
        glareOpacity.set(0)
      }}
    >
      {children}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={{ background: glare, opacity: glareOpacity }}
      />
    </motion.div>
  )
}
