import { SmoothScroll } from '@/components/motion/smooth-scroll'
import { BeforeAfter } from './before-after'
import { Faq } from './faq'
import { Features } from './features'
import { FinalCta } from './final-cta'
import { Footer } from './footer'
import { Hero } from './hero'
import { Nav } from './nav'
import { Radar } from './radar'
import { Safeguards } from './safeguards'
import { Steps } from './steps'

export function LandingPage() {
  return (
    <SmoothScroll>
      <div className="min-h-screen overflow-x-clip bg-cream text-ink">
        <Nav />
        <main>
          <Hero />
          <BeforeAfter />
          <Radar />
          <Features />
          <Steps />
          <Safeguards />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
      <div aria-hidden className="grain" />
    </SmoothScroll>
  )
}
