import { Marquee } from '@/components/motion/marquee'
import { signalsBand } from './content'

function Items({ dotClassName }: { dotClassName: string }) {
  return (
    <>
      {signalsBand.map((item) => (
        <span key={item} className="flex items-center">
          <span className="px-6 md:px-8">{item}</span>
          <span className={`size-2.5 rounded-full ${dotClassName}`} />
        </span>
      ))}
    </>
  )
}

/** Deux bandeaux croisés : les sources et les étapes du travail de Sophie. */
export function SignalsBand() {
  return (
    <section aria-label="Ce que Sophie surveille" className="relative overflow-hidden py-16 md:py-24">
      <div className="-rotate-[3deg] scale-110 bg-ink py-3 text-cream/60 md:py-4">
        <Marquee speed={-2.5} className="font-display text-lg font-medium tracking-tight md:text-2xl">
          <Items dotClassName="bg-cream/25" />
        </Marquee>
      </div>
      <div className="relative -mt-12 rotate-[2deg] scale-110 bg-brand-600 py-4 text-cream shadow-lift md:-mt-16 md:py-5">
        <Marquee speed={3} className="font-display text-xl font-semibold tracking-tight md:text-3xl">
          <Items dotClassName="bg-peach" />
        </Marquee>
      </div>
    </section>
  )
}
