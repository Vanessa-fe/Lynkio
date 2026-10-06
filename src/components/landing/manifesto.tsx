'use client'

import { motion, useScroll, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import { cn } from '@/lib/utils/cn'
import { manifesto } from './content'
import { SectionLabel } from './section-label'

type Token = { text: string; accent: boolean }

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  input.split(/(\*[^*]+\*)/g).forEach((chunk) => {
    if (!chunk) return
    const accent = chunk.startsWith('*') && chunk.endsWith('*')
    const clean = accent ? chunk.slice(1, -1) : chunk
    clean
      .split(/\s+/)
      .filter(Boolean)
      .forEach((text) => tokens.push({ text, accent }))
  })
  return tokens
}

function Word({ token, progress, range }: { token: Token; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.16, 1])
  return (
    <motion.span style={{ opacity }} className={cn('inline-block', token.accent && 'accent-serif text-brand-600')}>
      {token.text}
    </motion.span>
  )
}

/** Le constat : les mots s'allument au fil du scroll. */
export function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] })
  const tokens = tokenize(manifesto)

  return (
    <section className="px-4 py-24 md:px-6 md:py-36">
      <div className="mx-auto max-w-5xl">
        <SectionLabel index="01" label="Le constat" className="text-brand-700" />
        <p
          ref={ref}
          className="mt-8 font-display text-[clamp(1.75rem,3.8vw,3.3rem)] font-semibold leading-[1.15] tracking-[-0.035em] text-ink"
        >
          <span className="sr-only">{manifesto.replaceAll('*', '')}</span>
          <span aria-hidden>
            {tokens.map((token, i) => (
              <span key={i}>
                <Word token={token} progress={scrollYProgress} range={[i / tokens.length, (i + 1) / tokens.length]} />
                {i < tokens.length - 1 ? ' ' : null}
              </span>
            ))}
          </span>
        </p>
      </div>
    </section>
  )
}
