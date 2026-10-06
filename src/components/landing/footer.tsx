import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { FadeIn } from '@/components/motion/reveal'
import { SIGNUPS_OPEN } from '@/lib/constants/signup'

export function Footer() {
  return (
    <footer className="overflow-hidden border-t border-ink/[0.07]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 px-4 py-10 text-sm text-ink/60 sm:flex-row md:px-6">
        <Logo className="text-ink" />
        <p>L&apos;outil de prospection des freelances.</p>
        <div className="flex gap-5">
          <Link href="/login" className="hover:text-ink">
            Se connecter
          </Link>
          {SIGNUPS_OPEN && (
            <Link href="/signup" className="hover:text-ink">
              Créer un compte
            </Link>
          )}
        </div>
      </div>
      <FadeIn y={80} className="pointer-events-none select-none px-4 md:px-6">
        <p
          aria-hidden
          className="-mb-[0.22em] text-center font-display text-[24vw] font-bold leading-none tracking-[-0.07em] text-brand-100 lg:text-[19rem]"
        >
          lynkio
        </p>
      </FadeIn>
    </footer>
  )
}
