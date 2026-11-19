import Link from 'next/link'
import { LogoutButton } from '@/components/layout/logout-button'
import {
  ArrowRight,
  BellRing,
  Briefcase,
  Check,
  CreditCard,
  KeyRound,
  LifeBuoy,
  Lightbulb,
  ListOrdered,
  MessageSquareText,
  Puzzle,
  Radar,
  Target,
  User,
  type LucideIcon,
} from 'lucide-react'
import { GrowBar } from '@/components/motion/grow-bar'
import { Stagger, StaggerItem } from '@/components/motion/reveal'
import { hasAiAccess } from '@/lib/queries/ai-access'
import { getOffer } from '@/lib/queries/offer'
import { getProspectionSettings } from '@/lib/queries/prospection'
import { getUserProfile } from '@/lib/queries/user-profile'

type SettingsCard = {
  title: string
  icon: LucideIcon
  href: string
  color: string
  bgColor: string
}

// Rangés comme dans la maquette : la prospection, la façon de travailler, l'espace
const SECTIONS: { title: string; cards: SettingsCard[] }[] = [
  {
    title: 'Votre prospection',
    cards: [
      {
        title: 'Client idéal',
        icon: Target,
        href: '/settings/icp',
        color: 'text-rose-500',
        bgColor: 'bg-rose-500/10',
      },
      {
        title: 'Recherche de Sophie',
        icon: Radar,
        href: '/settings/prospection',
        color: 'text-indigo-500',
        bgColor: 'bg-indigo-500/10',
      },
      {
        title: 'Alertes de Sophie',
        icon: BellRing,
        href: '/notifications',
        color: 'text-sky-500',
        bgColor: 'bg-sky-500/10',
      },
      {
        title: 'Étapes et sources',
        icon: ListOrdered,
        href: '/settings/pipeline',
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
      },
    ],
  },
  {
    title: 'Votre façon de travailler',
    cards: [
      {
        title: 'Mon offre et mes objectifs',
        icon: Briefcase,
        href: '/settings/offer',
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
      },
      {
        title: 'Messages de Sophie',
        icon: MessageSquareText,
        href: '/settings/messages',
        color: 'text-teal-500',
        bgColor: 'bg-teal-500/10',
      },
      {
        title: 'Extension LinkedIn',
        icon: Puzzle,
        href: '/settings/extension',
        color: 'text-sky-500',
        bgColor: 'bg-sky-500/10',
      },
    ],
  },
  {
    title: 'Votre espace',
    cards: [
      {
        title: 'Vos clés',
        icon: KeyRound,
        href: '/settings/keys',
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
      },
      {
        title: 'Abonnement',
        icon: CreditCard,
        href: '/billing',
        color: 'text-teal-500',
        bgColor: 'bg-teal-500/10',
      },
      {
        title: 'Mon compte',
        icon: User,
        href: '/settings/account',
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
      },
      {
        title: 'Aide',
        icon: LifeBuoy,
        href: '/help',
        color: 'text-primary',
        bgColor: 'bg-primary/10',
      },
      {
        title: 'Boîte à idées',
        icon: Lightbulb,
        href: '/ideas',
        color: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
      },
    ],
  },
]

function SettingsLink({ card }: { card: SettingsCard }) {
  const Icon = card.icon
  return (
    <Link
      href={card.href}
      className="group flex h-full items-center gap-4 rounded-2xl border border-ink/[0.07] bg-card p-5 shadow-soft transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={`shrink-0 rounded-xl p-3 ${card.bgColor}`}>
        <Icon className={`size-6 ${card.color}`} />
      </span>
      <span className="min-w-0 flex-1 font-display text-lg font-semibold tracking-tight">{card.title}</span>
      <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  )
}

export default async function SettingsPage() {
  const [aiKey, offer, prospection, profile] = await Promise.all([
    hasAiAccess(),
    getOffer(),
    getProspectionSettings(),
    getUserProfile(),
  ])

  // Les réglages qui donnent à Sophie ses repères : ce qui est fait, ce qui reste
  const steps = [
    { label: 'IA de Sophie prête', done: aiKey, href: '/settings/keys' },
    { label: 'Offre décrite', done: offer !== null, href: '/settings/offer' },
    { label: 'Zone de recherche choisie', done: (prospection?.departments?.length ?? 0) > 0, href: '/settings/prospection' },
    { label: 'Présentation pour les messages', done: Boolean(profile?.message_pitch), href: '/settings/messages' },
  ]
  const doneCount = steps.filter((step) => step.done).length
  const complete = doneCount === steps.length

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold md:text-4xl">Paramètres</h1>
        {/* Mobile : pas de barre latérale, la déconnexion se trouve ici (Réglages, dans le menu du bas) */}
        <LogoutButton variant="outline" className="shrink-0 md:hidden" />
      </div>

      <section className="space-y-4 rounded-3xl bg-secondary px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-xl font-semibold tracking-tight text-secondary-foreground">
              {complete ? (
                <>
                  Votre espace est <span className="accent-serif text-primary">prêt</span>
                </>
              ) : (
                <>
                  Votre espace prend <span className="accent-serif text-primary">forme</span>
                </>
              )}
          </h2>
          <span className="shrink-0 self-start rounded-full bg-white px-3 py-1 text-sm font-medium tabular-nums shadow-sm">
            {doneCount} étape{doneCount > 1 ? 's' : ''} sur {steps.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white" aria-hidden="true">
          <GrowBar percent={(doneCount / steps.length) * 100} color="hsl(var(--primary))" />
        </div>
        <ul className="flex flex-wrap gap-2">
          {steps.map((step) => (
            <li key={step.label}>
              <Link
                href={step.href}
                className={
                  step.done
                    ? 'inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-sm text-muted-foreground'
                    : 'inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-white px-3 py-1 text-sm font-medium text-primary hover:border-primary'
                }
              >
                {step.done ? <Check className="size-3.5 text-emerald-600" /> : <ArrowRight className="size-3.5" />}
                {step.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-3">
          <h2 className="font-display text-lg font-semibold tracking-tight">{section.title}</h2>
          <Stagger className="grid gap-4 md:grid-cols-2" stagger={0.05}>
            {section.cards.map((card) => (
              <StaggerItem key={card.title} className="h-full">
                <SettingsLink card={card} />
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      ))}
    </div>
  )
}
