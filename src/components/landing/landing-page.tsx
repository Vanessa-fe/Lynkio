import { SmoothScroll } from '@/components/motion/smooth-scroll'
import { Features } from './features'
import { FinalCta } from './final-cta'
import { Footer } from './footer'
import { Hero } from './hero'
import { Manifesto } from './manifesto'
import { Nav } from './nav'
import { Safeguards } from './safeguards'
import { SignalsBand } from './signals-band'
import { Steps } from './steps'

export function LandingPage() {
  return (
    <SmoothScroll>
      <div className="min-h-screen overflow-x-clip bg-cream text-ink">
        <Nav />
        <main>
          <Hero />
          <SignalsBand />
          <Manifesto />
          <Features />
          <Steps />
          <Safeguards />
          <FinalCta />
        </main>
        <Footer />
      </div>
      <div aria-hidden className="grain" />
    </SmoothScroll>
  )
}
