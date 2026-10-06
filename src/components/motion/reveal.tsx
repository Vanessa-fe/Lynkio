'use client'

import { motion, useInView, type Variants } from 'motion/react'
import { useRef, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export const easeOutExpo = [0.16, 1, 0.3, 1] as const

type WordPart = { text: string; accent: boolean }

/**
 * Découpe « Trouvez les entreprises *au bon moment.* » en mots ;
 * les passages entre astérisques sont marqués `accent`.
 */
function splitWords(input: string): WordPart[][] {
  const words: WordPart[][] = []
  let current: WordPart[] = []
  const flush = () => {
    if (current.length) words.push(current)
    current = []
  }

  input.split(/(\*[^*]+\*)/g).forEach((chunk) => {
    if (!chunk) return
    const accent = chunk.startsWith('*') && chunk.endsWith('*')
    const clean = accent ? chunk.slice(1, -1) : chunk
    clean.split(/(\s+)/).forEach((piece) => {
      if (!piece) return
      if (/^\s+$/.test(piece)) flush()
      else current.push({ text: piece, accent })
    })
  })
  flush()
  return words
}

/** Titre dont chaque mot monte depuis un masque. `*mot*` = italique serif rouge. */
export function RevealWords({
  text,
  as: Tag = 'h2',
  className,
  accentClassName = 'text-primary',
  delay = 0,
  stagger = 0.05,
  show,
}: {
  text: string
  as?: ElementType
  className?: string
  accentClassName?: string
  delay?: number
  stagger?: number
  /** Contrôle externe (sinon : à l'entrée dans l'écran) */
  show?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' })
  const visible = show ?? inView
  const words = splitWords(text)

  return (
    <Tag ref={ref} className={className}>
      <span className="sr-only">{text.replaceAll('*', '')}</span>
      {words.map((word, i) => (
        <span key={i} aria-hidden>
          <span className="-mb-[0.14em] inline-block overflow-hidden px-[0.04em] pb-[0.14em] align-top">
            <motion.span
              className="inline-block will-change-transform"
              initial={{ y: '115%' }}
              animate={{ y: visible ? '0%' : '115%' }}
              transition={{ duration: 0.9, ease: easeOutExpo, delay: delay + i * stagger }}
            >
              {word.map((part, j) => (
                <span key={j} className={part.accent ? cn('accent-serif', accentClassName) : undefined}>
                  {part.text}
                </span>
              ))}
            </motion.span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  )
}

export function FadeIn({
  children,
  className,
  delay = 0,
  y = 24,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  as?: 'div' | 'p' | 'li' | 'span' | 'section'
}) {
  const Component = motion[as]
  return (
    <Component
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.8, ease: easeOutExpo, delay }}
    >
      {children}
    </Component>
  )
}

const staggerParent: Variants = {
  hidden: {},
  show: (stagger: number = 0.08) => ({ transition: { staggerChildren: stagger } }),
}

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOutExpo } },
}

/** Conteneur dont les `StaggerItem` apparaissent l'un après l'autre à l'entrée dans l'écran. */
export function Stagger({
  children,
  className,
  stagger = 0.08,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  stagger?: number
  as?: 'div' | 'ul' | 'ol'
}) {
  const Component = motion[as]
  return (
    <Component
      className={className}
      variants={staggerParent}
      custom={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      {children}
    </Component>
  )
}

export function StaggerItem({
  children,
  className,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'li'
}) {
  const Component = motion[as]
  return (
    <Component className={className} variants={staggerChild}>
      {children}
    </Component>
  )
}
