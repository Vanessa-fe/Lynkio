'use client'

import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

const wrap = (min: number, max: number, v: number) => {
  const range = max - min
  return ((((v - min) % range) + range) % range) + min
}

const COPIES = 4

/** Bandeau infini qui accélère et change de sens avec la vitesse du scroll. */
export function Marquee({
  children,
  speed = 3,
  className,
}: {
  children: ReactNode
  /** % de la largeur d'une copie par seconde ; négatif = vers la droite */
  speed?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  const baseX = useMotionValue(0)
  const { scrollY } = useScroll()
  const velocity = useSpring(useVelocity(scrollY), { damping: 50, stiffness: 400 })
  const factor = useTransform(velocity, [0, 1000], [0, 4], { clamp: false })
  const x = useTransform(baseX, (v) => `${wrap((-100 / COPIES) * 2, -100 / COPIES, v)}%`)
  const direction = useRef(1)

  useAnimationFrame((_, delta) => {
    if (reduce) return
    const f = factor.get()
    if (f < 0) direction.current = -1
    else if (f > 0) direction.current = 1
    let moveBy = (direction.current * -speed * delta) / 1000 / COPIES
    moveBy += moveBy * Math.abs(f)
    baseX.set(baseX.get() + moveBy)
  })

  return (
    <div className={cn('flex overflow-hidden whitespace-nowrap', className)}>
      <motion.div className="flex shrink-0 will-change-transform" style={{ x }}>
        {Array.from({ length: COPIES }, (_, i) => (
          <div key={i} className="flex shrink-0 items-center" aria-hidden={i > 0}>
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  )
}
