import { LogoMark } from '@/components/brand/logo'
import { FadeIn, RevealWords, Stagger, StaggerItem } from '@/components/motion/reveal'
import { cn } from '@/lib/utils/cn'
import { radarBlips, sources } from './content'
import { SectionLabel } from './section-label'

// Durée d'un tour de faisceau (doit suivre les animations `sweep`, `blip` et `blip-label`)
const TURN_S = 5
// Le bord lumineux du faisceau est à 70° de son point de départ (voir le dégradé conique)
const BEAM_EDGE_DEG = 70

/**
 * Décalage (négatif) qui fait s'allumer le point au moment où le faisceau passe dessus.
 * Toutes ces animations démarrent ensemble, en CSS : pas besoin de JavaScript.
 */
function blipDelay(angle: number) {
  const hit = (((angle - BEAM_EDGE_DEG) % 360) + 360) % 360
  return `${(hit / 360) * TURN_S - TURN_S}s`
}

function RadarScreen() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden>
      {/* Cercles et axes */}
      <div className="absolute inset-0 rounded-full border border-brand-200 bg-white shadow-lift" />
      {[0.75, 0.5, 0.25].map((scale) => (
        <div
          key={scale}
          className="absolute rounded-full border border-dashed border-brand-200/80"
          style={{ inset: `${((1 - scale) / 2) * 100}%` }}
        />
      ))}
      <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-brand-100" />
      <div className="absolute inset-x-4 top-1/2 h-px -translate-y-1/2 bg-brand-100" />

      {/* Faisceau qui tourne */}
      <div className="absolute inset-0 animate-sweep overflow-hidden rounded-full">
        <div
          className="absolute inset-0"
          style={{
            background: `conic-gradient(from 0deg, transparent 0deg, rgb(234 126 104 / 0) 8deg, rgb(234 126 104 / 0.42) ${BEAM_EDGE_DEG}deg, transparent ${BEAM_EDGE_DEG}deg)`,
          }}
        />
      </div>

      {/* Entreprises repérées */}
      {radarBlips.map((blip) => {
        const rad = (blip.angle * Math.PI) / 180
        const left = 50 + blip.distance * 50 * Math.sin(rad)
        const top = 50 - blip.distance * 50 * Math.cos(rad)
        const labelOnLeft = left > 58
        return (
          <div key={blip.angle} className="absolute" style={{ left: `${left}%`, top: `${top}%` }}>
            <span
              className="absolute -left-1.5 -top-1.5 size-3 animate-blip rounded-full bg-brand-600 ring-4 ring-brand-600/15"
              style={{ animationDelay: blipDelay(blip.angle) }}
            />
            {blip.label && (
              <span
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 whitespace-nowrap',
                  labelOnLeft ? 'right-4' : 'left-4'
                )}
              >
                <span
                  className="block animate-blip-label rounded-full border border-ink/[0.07] bg-white px-2.5 py-1 text-xs font-medium text-ink shadow-soft"
                  style={{ animationDelay: blipDelay(blip.angle) }}
                >
                  {blip.label}
                </span>
              </span>
            )}
          </div>
        )
      })}

      {/* Sophie au centre */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 animate-ping rounded-xl bg-brand-400/30 [animation-duration:2.5s]" />
        <LogoMark className="relative size-11 drop-shadow-md" />
      </div>
    </div>
  )
}

/** Ce que Sophie surveille : le radar et la liste des sources. */
export function Radar() {
  return (
    <section aria-label="Ce que Sophie surveille" className="px-4 py-20 md:px-6 md:py-28">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <SectionLabel label="Ce que Sophie surveille" />
          <RevealWords
            text="Pendant que vous travaillez, *Sophie surveille.*"
            accentClassName="text-brand-600"
            className="mt-6 font-display text-[clamp(2.2rem,4.6vw,3.8rem)] font-bold leading-[1.02] tracking-[-0.045em]"
          />
          <FadeIn>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink/65">
              Aux jours et à l&apos;heure que vous choisissez, elle parcourt des sources publiques et ne garde que les
              entreprises qui montrent un besoin.
            </p>
          </FadeIn>

          <Stagger as="ul" className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sources.map((source) => {
              const Icon = source.icon
              return (
                <StaggerItem as="li" key={source.title}>
                  <div className="group flex h-full gap-3 rounded-2xl border border-ink/[0.07] bg-white p-4 shadow-soft transition-shadow duration-500 hover:shadow-lift">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-transform duration-500 ease-out-expo group-hover:scale-110">
                      <Icon className="size-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-snug">{source.title}</p>
                      <p className="mt-0.5 text-sm text-ink/55">{source.text}</p>
                    </div>
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>
        </div>

        <FadeIn y={40}>
          <RadarScreen />
        </FadeIn>
      </div>
    </section>
  )
}
