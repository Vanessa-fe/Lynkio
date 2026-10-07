import { Plus } from 'lucide-react'
import { FadeIn, RevealWords, Stagger, StaggerItem } from '@/components/motion/reveal'
import { faqItems } from './content'
import { SectionLabel } from './section-label'

/**
 * Questions fréquentes en <details> natifs : lisibles sans JavaScript,
 * par les lecteurs d'écran et par les moteurs (texte présent dans la page).
 */
export function Faq() {
  return (
    <section id="questions" className="px-4 py-24 md:px-6 md:py-32">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionLabel label="Questions fréquentes" />
          <RevealWords
            text="Tout savoir sur *Lynkio.*"
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <FadeIn>
            <p className="mt-5 max-w-sm text-lg leading-relaxed text-ink/65">
              Les sources, le score, les messages : ce que fait Sophie, et ce qu&apos;elle ne fait pas.
            </p>
          </FadeIn>
        </div>

        <Stagger className="space-y-3" stagger={0.06}>
          {faqItems.map((item, i) => (
            <StaggerItem key={item.question}>
              <details
                className="group rounded-2xl border border-ink/[0.07] bg-white shadow-soft transition-shadow duration-300 open:shadow-lift"
                open={i === 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 font-display text-lg font-semibold tracking-tight marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:px-6 md:py-5 [&::-webkit-details-marker]:hidden">
                  <h3>{item.question}</h3>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-transform duration-300 group-open:rotate-45">
                    <Plus className="size-4" />
                  </span>
                </summary>
                <p className="px-5 pb-5 leading-relaxed text-ink/70 md:px-6 md:pb-6">{item.answer}</p>
              </details>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}
