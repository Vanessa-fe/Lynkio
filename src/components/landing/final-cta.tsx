import { Magnetic } from '@/components/motion/magnetic'
import { RevealWords } from '@/components/motion/reveal'
import { SIGNUPS_OPEN } from '@/lib/constants/signup'
import { CtaLink } from './cta-link'

export function FinalCta() {
  return (
    <section className="px-3 py-20 md:px-6 md:py-28">
      <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-brand-600 px-6 py-16 text-center text-cream md:rounded-[2.5rem] md:py-24">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute -left-24 -top-32 size-[28rem] animate-float rounded-full opacity-60 blur-3xl"
            style={{ background: 'radial-gradient(circle, #ea7e68 0%, transparent 65%)' }}
          />
          <div
            className="absolute -bottom-40 -right-24 size-[32rem] animate-float rounded-full opacity-50 blur-3xl [animation-delay:-4s]"
            style={{ background: 'radial-gradient(circle, #8b2e23 0%, transparent 65%)' }}
          />
        </div>
        <RevealWords
          text="Vos prochains clients sont peut-être *en train de recruter.*"
          accentClassName="text-peach"
          className="mx-auto max-w-3xl text-balance font-display text-[clamp(2rem,4.4vw,3.6rem)] font-bold leading-[1.05] tracking-[-0.045em]"
        />
        <p className="mx-auto mt-5 max-w-lg text-lg text-cream/80">
          Réglez votre client idéal en quelques minutes : Sophie s&apos;occupe du reste.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {SIGNUPS_OPEN && (
            <Magnetic>
              <CtaLink href="/signup" variant="light" arrow>
                Créer mon compte
              </CtaLink>
            </Magnetic>
          )}
          <Magnetic>
            <CtaLink href="/login" variant={SIGNUPS_OPEN ? 'outline-light' : 'light'} arrow={!SIGNUPS_OPEN}>
              Se connecter
            </CtaLink>
          </Magnetic>
        </div>
      </div>
    </section>
  )
}
