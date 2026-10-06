'use client'

import { useLenis } from 'lenis/react'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/brand/logo'
import { easeOutExpo } from '@/components/motion/reveal'
import { SIGNUPS_OPEN } from '@/lib/constants/signup'
import { cn } from '@/lib/utils/cn'
import { navLinks } from './content'
import { CtaLink, RollText } from './cta-link'

const easeInOut = [0.76, 0, 0.24, 1] as const

export function Nav() {
  const lenis = useLenis()
  const { scrollY } = useScroll()
  const [hidden, setHidden] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  // Barre cachée quand on descend, de retour dès qu'on remonte
  useMotionValueEvent(scrollY, 'change', (y) => {
    const prev = scrollY.getPrevious() ?? 0
    setHidden(y > prev && y > 480)
    setScrolled(y > 24)
  })

  useEffect(() => {
    if (!open) return
    lenis?.stop()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => {
      lenis?.start()
      window.removeEventListener('keydown', onKey)
    }
  }, [open, lenis])

  return (
    <>
      <motion.header
        className="fixed inset-x-0 top-0 z-50 px-3 pt-3 md:px-6 md:pt-4"
        initial={false}
        animate={{ y: hidden && !open ? -100 : 0 }}
        transition={{ duration: 0.7, ease: easeOutExpo }}
      >
        <nav
          aria-label="Navigation principale"
          className={cn(
            // Entrée en CSS sur la barre elle-même : l'en-tête garde sa position animée par Motion (masquée au scroll)
            'mx-auto flex max-w-6xl animate-fade-up items-center justify-between rounded-full border py-2 pl-4 pr-2 transition-[background-color,border-color,box-shadow] duration-500 [--fade-up-from:-24px]',
            scrolled || open
              ? 'border-ink/10 bg-cream/80 shadow-soft backdrop-blur-xl'
              : 'border-transparent bg-transparent'
          )}
        >
          <Logo ping onClick={() => setOpen(false)} />

          <ul className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="group block rounded-full px-4 py-2 text-sm font-medium text-ink/75 hover:bg-ink/5 hover:text-ink">
                  <RollText>{link.label}</RollText>
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-1.5">
            <Link
              href="/login"
              className={cn(
                'hidden rounded-full px-4 py-2.5 text-sm font-medium text-ink/75 hover:bg-ink/5 hover:text-ink sm:block',
                !SIGNUPS_OPEN && 'sm:hidden'
              )}
            >
              Se connecter
            </Link>
            <CtaLink href={SIGNUPS_OPEN ? '/signup' : '/login'} variant="dark" size="sm" className="hidden md:inline-flex">
              {SIGNUPS_OPEN ? 'Créer un compte' : 'Se connecter'}
            </CtaLink>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-full bg-ink text-cream md:hidden"
              aria-expanded={open}
              aria-controls="menu-mobile"
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="relative block h-3 w-5">
                <span
                  className={cn(
                    'absolute left-0 h-0.5 w-full rounded bg-current transition-all duration-500 ease-out-expo',
                    open ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-0'
                  )}
                />
                <span
                  className={cn(
                    'absolute left-0 h-0.5 w-full rounded bg-current transition-all duration-500 ease-out-expo',
                    open ? 'top-1/2 -translate-y-1/2 -rotate-45' : 'bottom-0'
                  )}
                />
              </span>
            </button>
          </div>
        </nav>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            className="fixed inset-0 z-40 flex flex-col justify-between bg-brand-600 px-6 pb-10 pt-28 text-cream md:hidden"
            initial={{ clipPath: 'circle(0% at calc(100% - 2.6rem) 2.2rem)' }}
            animate={{ clipPath: 'circle(150% at calc(100% - 2.6rem) 2.2rem)' }}
            exit={{ clipPath: 'circle(0% at calc(100% - 2.6rem) 2.2rem)' }}
            transition={{ duration: 0.7, ease: easeInOut }}
          >
            <ul className="space-y-2">
              {navLinks.map((link, i) => (
                <li key={link.href} className="overflow-hidden">
                  <motion.a
                    href={link.href}
                    onClick={(e) => {
                      e.preventDefault()
                      lenis?.start()
                      setOpen(false)
                      if (lenis) lenis.scrollTo(link.href, { duration: 1.2, offset: -80 })
                      else document.querySelector(link.href)?.scrollIntoView()
                    }}
                    className="block font-display text-[clamp(2.1rem,10.5vw,3rem)] font-semibold leading-tight tracking-[-0.04em]"
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.2 + i * 0.07 }}
                  >
                    {link.label}
                  </motion.a>
                </li>
              ))}
            </ul>
            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.6, ease: easeOutExpo }}
            >
              {SIGNUPS_OPEN && (
                <CtaLink href="/signup" variant="light" arrow className="w-full">
                  Créer mon compte
                </CtaLink>
              )}
              <CtaLink href="/login" variant={SIGNUPS_OPEN ? 'outline-light' : 'light'} className="w-full">
                Se connecter
              </CtaLink>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
